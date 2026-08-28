import unittest
from unittest.mock import patch

from python_scraper.analyze_job_fit import analyze_new_junior_job_fit


class AnalyzeJobFitTests(unittest.TestCase):
    @patch("python_scraper.analyze_job_fit.analyze_job_fit")
    @patch("python_scraper.analyze_job_fit._load_new_junior_jobs")
    def test_matching_job_is_prepared_for_sheet_without_database_write(
        self,
        load_jobs,
        analyze_fit,
    ):
        load_jobs.return_value = [
            (
                456,
                "Computer Vision Engineer",
                "Example Company",
                "Auckland",
                "https://www.seek.co.nz/job/456",
                "Build production computer vision systems.",
            )
        ]
        analyze_fit.return_value = {
            "is_match": True,
            "matched_directions": ["Computer Vision"],
            "reason": "Core duties involve computer vision.",
        }

        summary = analyze_new_junior_job_fit([456])

        self.assertEqual(summary["analyzed_count"], 1)
        self.assertEqual(summary["matched_count"], 1)
        self.assertEqual(summary["failed_count"], 0)
        self.assertEqual(
            summary["matched_jobs"],
            [
                {
                    "job_id": 456,
                    "job_title": "Computer Vision Engineer",
                    "company": "Example Company",
                    "job_type": "",
                    "location": "Auckland",
                    "link": "https://www.seek.co.nz/job/456",
                    "matched_directions": ["Computer Vision"],
                    "reason": "Core duties involve computer vision.",
                }
            ],
        )


if __name__ == "__main__":
    unittest.main()
