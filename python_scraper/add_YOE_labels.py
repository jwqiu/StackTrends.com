import os
import time

import requests

from .connect import get_conn


LLM_API_BASE = os.getenv(
    "STACKTRENDS_API_BASE",
    "https://stacktrends-api-v2-heh4cvffh3c4bwde.australiaeast-01.azurewebsites.net",
).rstrip("/")
LLM_ANALYZE_URL = f"{LLM_API_BASE}/api/llm/analyze-job-description"
LLM_REQUEST_TIMEOUT_SECONDS = 120
LLM_MAX_RETRIES = 3


def load_job_data():
    """Load jobs that are missing either YOE or job level."""
    conn = get_conn()
    if conn is None:
        raise RuntimeError("Unable to connect to the database.")

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT job_id, job_title, job_des,
                       year_of_experience, job_level
                FROM jobs
                WHERE (year_of_experience IS NULL
                       OR job_level IS NULL
                       OR BTRIM(job_level) = '')
                  AND job_des IS NOT NULL
                  AND BTRIM(job_des) <> ''
                ORDER BY listed_date DESC NULLS LAST, job_id DESC
                """
            )
            return cursor.fetchall()
    finally:
        conn.close()


def label_job_level_from_title(title):
    """Apply the existing job-level keywords to the title only."""
    if not isinstance(title, str):
        return "Other"

    normalized_title = title.lower()
    senior_keywords = [
        "senior",
        "lead",
        "principal",
        "architect",
        "head",
        "manager",
        "architecture",
    ]
    intermediate_keywords = [
        "intermediate",
        "mid-level",
        "mid level",
        "midlevel",
        "experienced",
    ]
    junior_keywords = [
        "junior",
        "graduate",
        "internship",
        "entry-level",
        "intern",
        "entry level",
        "entrylevel",
        "associate",
    ]

    if any(keyword in normalized_title for keyword in senior_keywords):
        return "Senior"
    if any(keyword in normalized_title for keyword in intermediate_keywords):
        return "Intermediate"
    if any(keyword in normalized_title for keyword in junior_keywords):
        return "Junior"
    return "Other"


def analyze_job(job_description):
    """Return YOE, job level, and job-level evidence from the backend LLM."""
    if not job_description or not job_description.strip():
        raise ValueError("Job description is empty.")

    last_error = None

    for attempt in range(1, LLM_MAX_RETRIES + 1):
        try:
            response = requests.post(
                LLM_ANALYZE_URL,
                json={"jobDescription": job_description},
                timeout=LLM_REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()

            payload = response.json()
            analysis = payload.get("analysis")
            if not isinstance(analysis, dict):
                raise ValueError("LLM response does not contain an analysis object.")

            yoe = analysis.get("yearOfExperience")
            job_level = analysis.get("jobLevel")
            job_level_evidence = analysis.get("jobLevelEvidence")

            # Keep compatibility with a deployed backend version that may still
            # return null when the JD has no explicit experience duration.
            if yoe is None:
                yoe = -1

            # The backend prompt permits only -1, 0, or a positive integer.
            # bool is excluded because it is a subclass of int in Python.
            if isinstance(yoe, bool) or not isinstance(yoe, int) or yoe < -1:
                raise ValueError(f"Invalid yearOfExperience returned by LLM: {yoe!r}")

            if job_level not in {"Junior", "Intermediate", "Senior"}:
                raise ValueError(f"Invalid jobLevel returned by LLM: {job_level!r}")

            if job_level_evidence is None:
                job_level_evidence = []
            if not isinstance(job_level_evidence, list) or any(
                not isinstance(item, str) for item in job_level_evidence
            ):
                raise ValueError(
                    "Invalid jobLevelEvidence returned by LLM: "
                    f"{job_level_evidence!r}"
                )

            evidence_text = "\n---\n".join(
                item.strip()
                for item in job_level_evidence[:3]
                if item.strip()
            )

            return yoe, job_level, evidence_text
        except (requests.RequestException, ValueError) as exc:
            last_error = exc
            if attempt < LLM_MAX_RETRIES:
                time.sleep(2 ** (attempt - 1))

    raise RuntimeError(
        f"LLM analysis failed after {LLM_MAX_RETRIES} attempts: {last_error}"
    )


def analyze_year_of_experience(job_description):
    """Backward-compatible helper for callers that only need YOE."""
    yoe, _, _ = analyze_job(job_description)
    return yoe


def update_year_of_experience_and_job_level():
    jobs = load_job_data()
    print(f"Total jobs missing YOE or job level: {len(jobs)}")

    if not jobs:
        return

    conn = get_conn()
    if conn is None:
        raise RuntimeError("Unable to connect to the database.")

    updated_count = 0
    failed_count = 0

    try:
        with conn.cursor() as cursor:
            for (
                job_id,
                job_title,
                job_description,
                existing_yoe,
                existing_job_level,
            ) in jobs:
                try:
                    llm_yoe, llm_job_level, llm_evidence = analyze_job(
                        job_description
                    )
                    title_job_level = label_job_level_from_title(job_title)
                    selected_job_level = (
                        llm_job_level
                        if title_job_level == "Other"
                        else title_job_level
                    )
                    selected_evidence = (
                        llm_evidence
                        if title_job_level == "Other"
                        else job_title.strip()
                    )

                    new_yoe = llm_yoe if existing_yoe is None else existing_yoe
                    new_job_level = (
                        selected_job_level
                        if not existing_job_level or not existing_job_level.strip()
                        else existing_job_level
                    )

                    cursor.execute(
                        """
                        UPDATE jobs
                        SET year_of_experience = CASE
                                WHEN year_of_experience IS NULL THEN %s
                                ELSE year_of_experience
                            END,
                            job_level = CASE
                                WHEN job_level IS NULL OR BTRIM(job_level) = ''
                                    THEN %s
                                ELSE job_level
                            END,
                            job_level_evidence = CASE
                                WHEN job_level IS NULL OR BTRIM(job_level) = ''
                                    THEN %s
                                ELSE job_level_evidence
                            END
                        WHERE job_id = %s
                          AND (
                              year_of_experience IS NULL
                              OR job_level IS NULL
                              OR BTRIM(job_level) = ''
                          )
                        """,
                        (new_yoe, new_job_level, selected_evidence, job_id),
                    )
                    updated_count += cursor.rowcount
                    conn.commit()
                    print(
                        f"Job {job_id}: year_of_experience = {new_yoe}, "
                        f"job_level = {new_job_level} "
                        f"(title rule: {title_job_level}, LLM: {llm_job_level})"
                    )
                except Exception as exc:
                    conn.rollback()
                    failed_count += 1
                    print(f"Job {job_id}: failed - {exc}")
    finally:
        conn.close()

    print(f"Jobs updated: {updated_count}")
    print(f"Jobs failed: {failed_count}")


def count_junior_jobs(job_ids):
    """Count Junior jobs among the jobs inserted by the current scraper run."""
    if not job_ids:
        return 0

    conn = get_conn()
    if conn is None:
        raise RuntimeError("Unable to connect to the database.")

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM jobs
                WHERE job_id = ANY(%s)
                  AND LOWER(BTRIM(job_level)) = 'junior'
                """,
                (job_ids,),
            )
            return cursor.fetchone()[0]
    finally:
        conn.close()


def update_year_of_experience():
    """Backward-compatible entry point for the combined enrichment process."""
    update_year_of_experience_and_job_level()


# Previous rule-based extraction logic (kept temporarily for reference):
#
# import re
#
# def extract_single_yoe_from_text(text, window_size=10):
#     """
#     Extract a single nearby year value, or 0 for a duration under 12 months.
#     This function is no longer used; YOE now comes from the backend LLM API.
#     """
#     if not text:
#         return None
#
#     text = text.lower()
#     matched_year_keywords = []
#     word_to_num = {
#         "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
#         "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
#         "eleven": "11",
#     }
#
#     for match in re.finditer(r"\byears?\b", text):
#         left_part = text[max(0, match.start() - window_size):match.start()]
#         for word, num in word_to_num.items():
#             left_part = re.sub(rf"\b{word}\b", num, left_part)
#         nums = re.findall(r"\b(10|[1-9])\b", left_part)
#         if len(nums) == 1:
#             matched_year_keywords.append(int(nums[0]))
#
#     if len(matched_year_keywords) == 1:
#         return matched_year_keywords[0]
#
#     if re.search(r"\b(1[01]|[1-9])\s*months?\b", text):
#         return "0"
#
#     return None
