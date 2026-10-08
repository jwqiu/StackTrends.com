import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlparse
from unittest.mock import patch

from scripts import switch_database


class SwitchDatabaseTests(unittest.TestCase):
    def test_build_npgsql_connection_string_decodes_uri_values(self):
        parsed = urlparse(
            "postgresql://test-user:p%40ss@example.aivencloud.com:1234/defaultdb"
        )

        result = switch_database.build_npgsql_connection_string(parsed)

        self.assertIn('Host="example.aivencloud.com"', result)
        self.assertIn("Port=1234", result)
        self.assertIn('Database="defaultdb"', result)
        self.assertIn('Username="test-user"', result)
        self.assertIn('Password="p@ss"', result)
        self.assertIn("SSL Mode=Require", result)

    def test_connection_values_escape_double_quotes(self):
        self.assertEqual(
            switch_database.quote_connection_value('a"b'),
            '"a""b"',
        )

    def test_read_active_target_rejects_unknown_target(self):
        with TemporaryDirectory() as directory:
            active_file = Path(directory) / "active_database.txt"
            active_file.write_text("unknown\n", encoding="utf-8")
            with patch.object(
                switch_database,
                "ACTIVE_DATABASE_FILE",
                active_file,
            ):
                with self.assertRaisesRegex(RuntimeError, "开关值无效"):
                    switch_database.read_active_target()


if __name__ == "__main__":
    unittest.main()
