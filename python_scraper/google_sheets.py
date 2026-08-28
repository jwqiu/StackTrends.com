import os
import re
from urllib.parse import parse_qs, urlparse


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_CREDENTIALS_PATH = os.path.join(
    PROJECT_ROOT,
    "secrets",
    "google-sheets-service-account.json",
)
SPREADSHEET_ID = os.getenv(
    "STACKTREND_GOOGLE_SHEET_ID",
    "1EdBQ7w1wuzKKHPS4TMt12_KK7FTeo01coeFqi4Cx5CE",
)
SHEET_NAME = os.getenv("STACKTREND_GOOGLE_SHEET_NAME", "Sheet1")
TARGET_SECTION_TITLE = os.getenv(
    "STACKTREND_GOOGLE_SHEET_SECTION",
    "Jobs to Apply",
)
GOOGLE_CREDENTIALS_PATH = os.getenv(
    "STACKTREND_GOOGLE_CREDENTIALS",
    os.getenv("GOOGLE_APPLICATION_CREDENTIALS", DEFAULT_CREDENTIALS_PATH),
)
SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"


def _build_sheets_service():
    if not os.path.isfile(GOOGLE_CREDENTIALS_PATH):
        raise RuntimeError(
            f"Google Sheets credentials file was not found: "
            f"{GOOGLE_CREDENTIALS_PATH}. Save the Service Account JSON there "
            "or set STACKTREND_GOOGLE_CREDENTIALS."
        )

    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
    except ImportError as error:
        raise RuntimeError(
            "Google Sheets dependencies are missing. Install "
            "python_scraper/requirements.txt in the project virtual environment."
        ) from error

    credentials = Credentials.from_service_account_file(
        GOOGLE_CREDENTIALS_PATH,
        scopes=[SHEETS_SCOPE],
    )
    return build("sheets", "v4", credentials=credentials, cache_discovery=False)


def _normalize_link(link):
    """Return a stable key so different SEEK URL variants do not duplicate."""
    if not isinstance(link, str) or not link.strip():
        return ""

    normalized = link.strip()
    parsed = urlparse(normalized)

    path_match = re.search(r"/job/(\d+)", parsed.path, flags=re.IGNORECASE)
    if path_match:
        return f"seek:{path_match.group(1)}"

    query_job_ids = parse_qs(parsed.query).get("jobId", [])
    if query_job_ids and query_job_ids[0].isdigit():
        return f"seek:{query_job_ids[0]}"

    return normalized.rstrip("/").lower()


def _get_sheet_rows(service):
    response = (
        service.spreadsheets()
        .values()
        .get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{SHEET_NAME}!A:E",
        )
        .execute()
    )
    return response.get("values", [])


def _find_section_row(rows):
    expected_title = TARGET_SECTION_TITLE.casefold()
    for row_number, row in enumerate(rows, start=1):
        if any(
            str(cell).strip().casefold() == expected_title
            for cell in row
        ):
            return row_number

    raise RuntimeError(
        f'Google Sheet section "{TARGET_SECTION_TITLE}" was not found in '
        f'worksheet "{SHEET_NAME}". No jobs were written.'
    )


def _get_existing_link_keys(rows):
    return {
        link_key
        for row in rows
        if len(row) >= 5
        for link_key in [_normalize_link(row[4])]
        if link_key
    }


def append_matching_jobs(matched_jobs, service=None):
    """Append new matching jobs to columns A:E without changing PostgreSQL."""
    if not matched_jobs:
        return {
            "appended_count": 0,
            "duplicate_count": 0,
        }

    sheets_service = service or _build_sheets_service()
    sheet_rows = _get_sheet_rows(sheets_service)
    section_row = _find_section_row(sheet_rows)
    existing_link_keys = _get_existing_link_keys(sheet_rows)
    rows_to_append = []
    duplicate_count = 0

    for job in matched_jobs:
        link = str(job.get("link") or "").strip()
        link_key = _normalize_link(link)
        if not link_key:
            raise ValueError(
                f"Matching job {job.get('job_id')} does not contain a valid link."
            )
        if link_key in existing_link_keys:
            duplicate_count += 1
            print(f"Google Sheet duplicate skipped: {link}")
            continue

        rows_to_append.append(
            [
                str(job.get("job_title") or "").strip(),
                str(job.get("company") or "").strip(),
                "",
                str(job.get("location") or "").strip(),
                link,
            ]
        )
        existing_link_keys.add(link_key)

    if rows_to_append:
        (
            sheets_service.spreadsheets()
            .values()
            .append(
                spreadsheetId=SPREADSHEET_ID,
                # Anchoring the append range at the section header keeps new
                # jobs in the logical table immediately below "Jobs to Apply".
                range=f"{SHEET_NAME}!A{section_row}:E",
                valueInputOption="RAW",
                insertDataOption="INSERT_ROWS",
                body={"values": rows_to_append},
            )
            .execute()
        )

    print(f"Google Sheet jobs appended: {len(rows_to_append)}")
    print(f"Google Sheet duplicates skipped: {duplicate_count}")
    return {
        "appended_count": len(rows_to_append),
        "duplicate_count": duplicate_count,
    }
