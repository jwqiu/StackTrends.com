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
    """Load only jobs that have not received a YOE value yet."""
    conn = get_conn()
    if conn is None:
        raise RuntimeError("Unable to connect to the database.")

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT job_id, job_des
                FROM jobs
                WHERE year_of_experience IS NULL
                  AND job_des IS NOT NULL
                  AND BTRIM(job_des) <> ''
                ORDER BY listed_date DESC NULLS LAST, job_id DESC
                """
            )
            return cursor.fetchall()
    finally:
        conn.close()


def analyze_year_of_experience(job_description):
    """Call the existing backend LLM endpoint and return only its YOE result."""
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
            yoe = payload.get("analysis", {}).get("yearOfExperience")

            # Keep compatibility with a deployed backend version that may still
            # return null when the JD has no explicit experience duration.
            if yoe is None:
                yoe = -1

            # The backend prompt permits only -1, 0, or a positive integer.
            # bool is excluded because it is a subclass of int in Python.
            if isinstance(yoe, bool) or not isinstance(yoe, int) or yoe < -1:
                raise ValueError(f"Invalid yearOfExperience returned by LLM: {yoe!r}")

            return yoe
        except (requests.RequestException, ValueError) as exc:
            last_error = exc
            if attempt < LLM_MAX_RETRIES:
                time.sleep(2 ** (attempt - 1))

    raise RuntimeError(
        f"LLM analysis failed after {LLM_MAX_RETRIES} attempts: {last_error}"
    )


def update_year_of_experience():
    jobs = load_job_data()
    print(f"Total jobs with NULL YOE: {len(jobs)}")

    if not jobs:
        return

    conn = get_conn()
    if conn is None:
        raise RuntimeError("Unable to connect to the database.")

    updated_count = 0
    failed_count = 0

    try:
        with conn.cursor() as cursor:
            for job_id, job_description in jobs:
                try:
                    yoe = analyze_year_of_experience(job_description)
                    cursor.execute(
                        """
                        UPDATE jobs
                        SET year_of_experience = %s
                        WHERE job_id = %s
                          AND year_of_experience IS NULL
                        """,
                        (yoe, job_id),
                    )
                    updated_count += cursor.rowcount
                    conn.commit()
                    print(f"Job {job_id}: year_of_experience = {yoe}")
                except Exception as exc:
                    conn.rollback()
                    failed_count += 1
                    print(f"Job {job_id}: failed - {exc}")
    finally:
        conn.close()

    print(f"YOE updated: {updated_count}")
    print(f"YOE failed: {failed_count}")


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
