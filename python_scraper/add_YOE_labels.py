import json
import os
import time
from pathlib import Path

import requests

from .connect import get_conn


OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
OPENAI_MODEL = os.getenv("STACKTREND_OPENAI_MODEL", "gpt-4.1-mini")
LLM_REQUEST_TIMEOUT_SECONDS = 120
LLM_MAX_RETRIES = 3

JOB_LEVEL_INSTRUCTIONS = """
You analyze New Zealand IT job descriptions and return structured data for
year-of-experience and job-level classification.

yearOfExperience:
- Return only an integer: -1, 0, or a positive integer.
- First use an explicitly stated overall professional experience requirement.
- Otherwise use the requirement for the role's core skill. If the core skill
  cannot be determined, use the highest explicit work-experience duration.
- For a range, return its lowest value. For less than 12 months, return 0.
- Return -1 when no clear, specific experience duration is stated.
- Never infer a duration from seniority, responsibilities, salary, role
  complexity, security-clearance history, residency, citizenship, immigration,
  project or contract duration, company or technology age, tenure, benefits,
  notice periods, working hours, or scheduling information.

jobLevel:
- Must be exactly Junior, Intermediate, or Senior.
- Prefer a directly stated level such as junior, graduate, entry-level,
  intermediate, mid-level, senior, lead, or principal.
- Otherwise infer primarily from experience: 0-2 years is Junior, 3-5 years is
  Intermediate, and 6+ years is Senior.
- If experience is unclear, infer from responsibilities, technical complexity,
  ownership, salary, and leadership or mentoring expectations in the New
  Zealand IT job market.

jobLevelEvidence:
- Return at most 3 short pieces of evidence copied verbatim from the original
  job description, strongest first.
- Do not explain or rewrite the evidence. Return an empty list if there is no
  clear evidence.
""".strip()

JOB_LEVEL_SCHEMA = {
    "type": "object",
    "properties": {
        "yearOfExperience": {"type": "integer", "minimum": -1},
        "jobLevel": {
            "type": "string",
            "enum": ["Junior", "Intermediate", "Senior"],
        },
        "jobLevelEvidence": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["yearOfExperience", "jobLevel", "jobLevelEvidence"],
    "additionalProperties": False,
}


def _load_openai_api_key():
    """Load the key locally without depending on the deployed backend."""
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if api_key:
        return api_key

    # Transitional fallback: reuse the ignored local backend settings file so
    # the existing scheduled scraper keeps working after Azure App Service is
    # removed. OPENAI_API_KEY remains the preferred long-term configuration.
    settings_path = (
        Path(__file__).resolve().parents[1] / "01_backend" / "appsettings.json"
    )
    if settings_path.exists():
        try:
            settings = json.loads(settings_path.read_text(encoding="utf-8-sig"))
            api_key = str(settings.get("OpenAI", {}).get("ApiKey", "")).strip()
        except (OSError, ValueError, TypeError):
            api_key = ""
        if api_key:
            return api_key

    raise RuntimeError(
        "OpenAI API key is not configured. Set the OPENAI_API_KEY environment "
        "variable before running the scraper."
    )


def _extract_response_text(payload):
    """Extract Structured Outputs text from an OpenAI Responses API payload."""
    for output_item in payload.get("output", []):
        if output_item.get("type") != "message":
            continue
        for content_item in output_item.get("content", []):
            if content_item.get("type") == "output_text":
                text = content_item.get("text")
                if isinstance(text, str) and text.strip():
                    return text

    raise ValueError("OpenAI response does not contain structured output text.")


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
    """Return YOE, job level, and evidence directly from OpenAI."""
    if not job_description or not job_description.strip():
        raise ValueError("Job description is empty.")

    api_key = _load_openai_api_key()
    last_error = None

    for attempt in range(1, LLM_MAX_RETRIES + 1):
        try:
            response = requests.post(
                OPENAI_RESPONSES_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": OPENAI_MODEL,
                    "instructions": JOB_LEVEL_INSTRUCTIONS,
                    "input": (
                        "Analyze this job description:\n\n"
                        f"{job_description}"
                    ),
                    "text": {
                        "format": {
                            "type": "json_schema",
                            "name": "job_level_analysis",
                            "strict": True,
                            "schema": JOB_LEVEL_SCHEMA,
                        }
                    },
                    "store": False,
                },
                timeout=LLM_REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()

            payload = response.json()
            analysis = json.loads(_extract_response_text(payload))
            if not isinstance(analysis, dict):
                raise ValueError("OpenAI response is not a JSON object.")

            yoe = analysis.get("yearOfExperience")
            job_level = analysis.get("jobLevel")
            job_level_evidence = analysis.get("jobLevelEvidence")

            # bool is excluded because it is a subclass of int in Python.
            if isinstance(yoe, bool) or not isinstance(yoe, int) or yoe < -1:
                raise ValueError(f"Invalid yearOfExperience returned by LLM: {yoe!r}")

            if job_level not in {"Junior", "Intermediate", "Senior"}:
                raise ValueError(f"Invalid jobLevel returned by LLM: {job_level!r}")

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
