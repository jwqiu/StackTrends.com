import os
import time

import requests

from .connect import get_conn


LLM_API_BASE = os.getenv(
    "STACKTRENDS_API_BASE",
    "https://stacktrends-api-v2-heh4cvffh3c4bwde.australiaeast-01.azurewebsites.net",
).rstrip("/")
LLM_JOB_FIT_URL = f"{LLM_API_BASE}/api/llm/analyze-job-fit"
LLM_REQUEST_TIMEOUT_SECONDS = 120
LLM_MAX_RETRIES = 3
ALLOWED_DIRECTIONS = {
    "Computer Vision",
    "AI Automation",
    "Machine Learning",
}


def analyze_job_fit(job_title, job_description):
    """Return a validated job-fit result from the backend LLM endpoint."""
    if not job_title or not job_title.strip():
        raise ValueError("Job title is empty.")
    if not job_description or not job_description.strip():
        raise ValueError("Job description is empty.")

    last_error = None

    for attempt in range(1, LLM_MAX_RETRIES + 1):
        try:
            response = requests.post(
                LLM_JOB_FIT_URL,
                json={
                    "jobTitle": job_title,
                    "jobDescription": job_description,
                },
                timeout=LLM_REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()

            payload = response.json()
            analysis = payload.get("analysis")
            if not isinstance(analysis, dict):
                raise ValueError("LLM response does not contain an analysis object.")

            is_match = analysis.get("isMatch")
            matched_directions = analysis.get("matchedDirections")
            reason = analysis.get("reason")

            if not isinstance(is_match, bool):
                raise ValueError(f"Invalid isMatch value: {is_match!r}")
            if not isinstance(matched_directions, list) or any(
                not isinstance(direction, str)
                for direction in matched_directions
            ):
                raise ValueError(
                    f"Invalid matchedDirections value: {matched_directions!r}"
                )
            if len(matched_directions) != len(set(matched_directions)):
                raise ValueError("matchedDirections contains duplicate values.")
            if not set(matched_directions).issubset(ALLOWED_DIRECTIONS):
                raise ValueError(
                    f"Unexpected matched direction: {matched_directions!r}"
                )
            if is_match and not matched_directions:
                raise ValueError("A matching role has no matched direction.")
            if not is_match and matched_directions:
                raise ValueError("A non-matching role has matched directions.")
            if not isinstance(reason, str) or not reason.strip():
                raise ValueError(f"Invalid reason value: {reason!r}")

            return {
                "is_match": is_match,
                "matched_directions": matched_directions,
                "reason": reason.strip(),
            }
        except (requests.RequestException, ValueError) as error:
            last_error = error
            if attempt < LLM_MAX_RETRIES:
                time.sleep(2 ** (attempt - 1))

    raise RuntimeError(
        f"Job-fit analysis failed after {LLM_MAX_RETRIES} attempts: {last_error}"
    )


def _load_new_junior_jobs(job_ids):
    if not job_ids:
        return []

    conn = get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT job_id, job_title, company_name, location, job_url, job_des
                FROM jobs
                WHERE job_id = ANY(%s)
                  AND LOWER(BTRIM(job_level)) = 'junior'
                  AND job_des IS NOT NULL
                  AND BTRIM(job_des) <> ''
                ORDER BY job_id
                """,
                (job_ids,),
            )
            return cursor.fetchall()
    finally:
        conn.close()


def _save_job_fit_results(job_fit_results):
    """Save successful analyses; unanalysed or failed jobs remain NULL."""
    if not job_fit_results:
        return

    conn = get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.executemany(
                """
                UPDATE jobs
                SET "isMatch" = %s
                WHERE job_id = %s
                """,
                [
                    (is_match, job_id)
                    for job_id, is_match in job_fit_results
                ],
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def analyze_new_junior_job_fit(job_ids):
    """Analyze this run's Junior jobs and save successful fit decisions."""
    jobs = _load_new_junior_jobs(job_ids)
    print(f"Junior jobs waiting for career-direction analysis: {len(jobs)}")

    if not jobs:
        return {
            "analyzed_count": 0,
            "matched_count": 0,
            "failed_count": 0,
            "matched_jobs": [],
        }

    analyzed_count = 0
    matched_count = 0
    failed_count = 0
    matched_jobs = []
    job_fit_results = []

    for (
        job_id,
        job_title,
        company_name,
        location,
        job_url,
        job_description,
    ) in jobs:
        try:
            result = analyze_job_fit(job_title, job_description)
            analyzed_count += 1
            job_fit_results.append((job_id, result["is_match"]))
            if result["is_match"]:
                matched_count += 1
                matched_jobs.append(
                    {
                        "job_id": job_id,
                        "job_title": job_title,
                        "company": company_name or "",
                        "job_type": "",
                        "location": location or "",
                        "link": job_url or "",
                        "matched_directions": result["matched_directions"],
                        "reason": result["reason"],
                    }
                )

            directions = ", ".join(result["matched_directions"]) or "None"
            print(
                f"Job {job_id}: career_match = {result['is_match']}, "
                f"directions = {directions}, reason = {result['reason']}"
            )
        except Exception as error:
            failed_count += 1
            print(f"Job {job_id}: career-direction analysis failed - {error}")

    _save_job_fit_results(job_fit_results)

    print(f"Career-direction jobs analyzed: {analyzed_count}")
    print(f"Career-direction matches: {matched_count}")
    print(f"Career-direction analysis failures: {failed_count}")

    return {
        "analyzed_count": analyzed_count,
        "matched_count": matched_count,
        "failed_count": failed_count,
        "matched_jobs": matched_jobs,
    }
