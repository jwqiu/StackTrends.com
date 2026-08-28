import unittest
from unittest.mock import MagicMock

from python_scraper.google_sheets import _normalize_link, append_matching_jobs


class GoogleSheetsTests(unittest.TestCase):
    def test_normalize_seek_link_uses_job_id(self):
        self.assertEqual(
            _normalize_link("https://www.seek.co.nz/job/123?tracking=abc"),
            _normalize_link("https://nz.seek.com/job/123"),
        )
        self.assertEqual(
            _normalize_link("https://www.seek.co.nz/jobs?jobId=123"),
            "seek:123",
        )

    def test_append_skips_duplicates_and_leaves_job_type_blank(self):
        service = MagicMock()
        values_api = service.spreadsheets.return_value.values.return_value
        values_api.get.return_value.execute.return_value = {
            "values": [
                ["Job title", "Company", "Job type", "Location", "Link"],
                [],
                ["Jobs to Apply"],
                [
                    "Existing ML Engineer",
                    "Existing Company",
                    "",
                    "Christchurch",
                    "https://www.seek.co.nz/job/123?tracking=old",
                ],
            ]
        }
        values_api.append.return_value.execute.return_value = {}

        summary = append_matching_jobs(
            [
                {
                    "job_id": 123,
                    "job_title": "Existing ML Engineer",
                    "company": "Existing Company",
                    "location": "Christchurch",
                    "link": "https://nz.seek.com/job/123",
                },
                {
                    "job_id": 456,
                    "job_title": "Computer Vision Engineer",
                    "company": "Example Company",
                    "location": "Auckland",
                    "link": "https://www.seek.co.nz/job/456?tracking=new",
                },
                {
                    "job_id": 456,
                    "job_title": "Duplicate CV Engineer",
                    "company": "Example Company",
                    "location": "Auckland",
                    "link": "https://nz.seek.com/job/456",
                },
            ],
            service=service,
        )

        self.assertEqual(summary, {"appended_count": 1, "duplicate_count": 2})
        values_api.append.assert_called_once_with(
            spreadsheetId="1EdBQ7w1wuzKKHPS4TMt12_KK7FTeo01coeFqi4Cx5CE",
            range="Sheet1!A3:E",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={
                "values": [
                    [
                        "Computer Vision Engineer",
                        "Example Company",
                        "",
                        "Auckland",
                        "https://www.seek.co.nz/job/456?tracking=new",
                    ]
                ]
            },
        )

    def test_missing_jobs_to_apply_section_stops_without_writing(self):
        service = MagicMock()
        values_api = service.spreadsheets.return_value.values.return_value
        values_api.get.return_value.execute.return_value = {
            "values": [["Job title", "Company", "Job type", "Location", "Link"]]
        }

        with self.assertRaisesRegex(RuntimeError, "Jobs to Apply"):
            append_matching_jobs(
                [
                    {
                        "job_id": 456,
                        "job_title": "Computer Vision Engineer",
                        "company": "Example Company",
                        "location": "Auckland",
                        "link": "https://www.seek.co.nz/job/456",
                    }
                ],
                service=service,
            )

        values_api.append.assert_not_called()

    def test_empty_match_list_does_not_connect_to_google(self):
        self.assertEqual(
            append_matching_jobs([]),
            {"appended_count": 0, "duplicate_count": 0},
        )


if __name__ == "__main__":
    unittest.main()
