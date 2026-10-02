import json
import unittest
from unittest.mock import MagicMock, patch

from python_scraper import add_YOE_labels


class AnalyzeJobLevelTests(unittest.TestCase):
    @patch("python_scraper.add_YOE_labels._load_openai_api_key")
    @patch("python_scraper.add_YOE_labels.requests.post")
    def test_analyze_job_calls_openai_directly_with_structured_output(
        self,
        post,
        load_api_key,
    ):
        load_api_key.return_value = "test-key"
        response = MagicMock()
        response.json.return_value = {
            "output": [
                {
                    "type": "message",
                    "content": [
                        {
                            "type": "output_text",
                            "text": json.dumps(
                                {
                                    "yearOfExperience": 3,
                                    "jobLevel": "Intermediate",
                                    "jobLevelEvidence": [
                                        "3+ years of commercial experience"
                                    ],
                                }
                            ),
                        }
                    ],
                }
            ]
        }
        post.return_value = response

        result = add_YOE_labels.analyze_job(
            "You have 3+ years of commercial experience."
        )

        self.assertEqual(
            result,
            (3, "Intermediate", "3+ years of commercial experience"),
        )
        response.raise_for_status.assert_called_once_with()
        request = post.call_args
        self.assertEqual(request.args[0], "https://api.openai.com/v1/responses")
        self.assertEqual(
            request.kwargs["headers"]["Authorization"],
            "Bearer test-key",
        )
        self.assertEqual(
            request.kwargs["json"]["text"]["format"]["type"],
            "json_schema",
        )
        self.assertTrue(request.kwargs["json"]["text"]["format"]["strict"])

    @patch("python_scraper.add_YOE_labels._load_openai_api_key")
    @patch("python_scraper.add_YOE_labels.requests.post")
    def test_analyze_job_rejects_invalid_structured_values(
        self,
        post,
        load_api_key,
    ):
        load_api_key.return_value = "test-key"
        response = MagicMock()
        response.json.return_value = {
            "output": [
                {
                    "type": "message",
                    "content": [
                        {
                            "type": "output_text",
                            "text": json.dumps(
                                {
                                    "yearOfExperience": 2,
                                    "jobLevel": "Other",
                                    "jobLevelEvidence": [],
                                }
                            ),
                        }
                    ],
                }
            ]
        }
        post.return_value = response

        with patch("python_scraper.add_YOE_labels.time.sleep"):
            with self.assertRaisesRegex(RuntimeError, "Invalid jobLevel"):
                add_YOE_labels.analyze_job("Example job description")

        self.assertEqual(post.call_count, 3)


if __name__ == "__main__":
    unittest.main()
