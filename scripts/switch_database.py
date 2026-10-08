#!/usr/bin/env python3
"""Switch the scraper and backend between Aiven and Azure PostgreSQL."""

import argparse
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlparse
from urllib.request import urlopen

import psycopg2


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SECRETS_DIR = PROJECT_ROOT / "secrets"
ACTIVE_DATABASE_FILE = SECRETS_DIR / "active_database.txt"
BACKEND_CONFIG_FILE = PROJECT_ROOT / "01_backend" / "appsettings.json"

AZURE_RESOURCE_GROUP = "stacktrends-rg"
AZURE_WEBAPP_NAME = "stacktrends-api-v2"
BACKEND_COUNT_URL = (
    "https://stacktrends-api-v2-heh4cvffh3c4bwde.australiaeast-01."
    "azurewebsites.net/api/stats/jobs/count"
)

TARGET_HOST_SUFFIXES = {
    "aiven": "aivencloud.com",
    "azure": "postgres.database.azure.com",
}


def load_database_uri(target):
    path = SECRETS_DIR / f"{target}_database_url.txt"
    if not path.is_file():
        raise RuntimeError(f"缺少安全连接文件: {path}")

    uri = path.read_text(encoding="utf-8").strip()
    parsed = urlparse(uri)
    expected_suffix = TARGET_HOST_SUFFIXES[target]
    if (
        parsed.scheme not in {"postgres", "postgresql"}
        or not parsed.hostname
        or not parsed.username
        or not parsed.password
        or not parsed.path.strip("/")
        or not parsed.hostname.endswith(expected_suffix)
    ):
        raise RuntimeError(f"{target} 的数据库连接文件格式或主机不正确。")
    return uri, parsed


def quote_connection_value(value):
    return '"' + str(value).replace('"', '""') + '"'


def build_npgsql_connection_string(parsed):
    database = unquote(parsed.path.lstrip("/"))
    username = unquote(parsed.username or "")
    password = unquote(parsed.password or "")
    values = [
        f"Host={quote_connection_value(parsed.hostname)}",
        f"Port={parsed.port or 5432}",
        f"Database={quote_connection_value(database)}",
        f"Username={quote_connection_value(username)}",
        f"Password={quote_connection_value(password)}",
        "SSL Mode=Require",
        "Trust Server Certificate=true",
        "Maximum Pool Size=5",
        "Timeout=15",
    ]
    return ";".join(values)


def verify_database(uri):
    with psycopg2.connect(uri, connect_timeout=15) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT count(*) FROM public.jobs")
            return int(cursor.fetchone()[0])


def write_private_file(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_name(f".{path.name}.tmp")
    temporary_path.write_text(content, encoding="utf-8")
    os.chmod(temporary_path, 0o600)
    temporary_path.replace(path)


def read_active_target():
    if not ACTIVE_DATABASE_FILE.is_file():
        return "aiven"
    target = ACTIVE_DATABASE_FILE.read_text(encoding="utf-8").strip().lower()
    if target not in TARGET_HOST_SUFFIXES:
        raise RuntimeError(f"当前数据库开关值无效: {target}")
    return target


def update_local_configuration(target, connection_string):
    config = json.loads(BACKEND_CONFIG_FILE.read_text(encoding="utf-8"))
    config.setdefault("ConnectionStrings", {})[
        "DefaultConnection"
    ] = connection_string
    write_private_file(
        BACKEND_CONFIG_FILE,
        json.dumps(config, indent=4, ensure_ascii=False) + "\n",
    )
    write_private_file(ACTIVE_DATABASE_FILE, target + "\n")


def run_azure_cli(arguments):
    subprocess.run(
        ["az", *arguments],
        cwd=PROJECT_ROOT,
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )


def update_online_backend(connection_string):
    run_azure_cli(["account", "show", "--output", "none"])

    settings_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            prefix="stacktrend-db-setting-",
            suffix=".json",
            delete=False,
        ) as settings_file:
            json.dump(
                {"ConnectionStrings__DefaultConnection": connection_string},
                settings_file,
            )
            settings_path = Path(settings_file.name)
        os.chmod(settings_path, 0o600)

        run_azure_cli(
            [
                "webapp",
                "config",
                "appsettings",
                "set",
                "--resource-group",
                AZURE_RESOURCE_GROUP,
                "--name",
                AZURE_WEBAPP_NAME,
                "--settings",
                f"@{settings_path}",
                "--output",
                "none",
            ]
        )
    finally:
        if settings_path is not None:
            settings_path.unlink(missing_ok=True)

    run_azure_cli(
        [
            "webapp",
            "restart",
            "--resource-group",
            AZURE_RESOURCE_GROUP,
            "--name",
            AZURE_WEBAPP_NAME,
            "--output",
            "none",
        ]
    )


def verify_online_backend(expected_count):
    last_error = None
    for _ in range(12):
        try:
            with urlopen(BACKEND_COUNT_URL, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
            actual_count = int(payload["count"])
            if actual_count != expected_count:
                raise RuntimeError(
                    "线上后端返回的职位数量与目标数据库不一致: "
                    f"backend={actual_count}, database={expected_count}"
                )
            return actual_count
        except (
            HTTPError,
            URLError,
            TimeoutError,
            KeyError,
            ValueError,
            RuntimeError,
        ) as error:
            last_error = error
            time.sleep(5)
    raise RuntimeError(f"线上后端重启后验证失败: {last_error}")


def parse_args():
    parser = argparse.ArgumentParser(
        description="同时切换 StackTrend 爬虫和后端使用的 PostgreSQL。"
    )
    parser.add_argument("target", choices=sorted(TARGET_HOST_SUFFIXES))
    parser.add_argument(
        "--local-only",
        action="store_true",
        help="只切换本地爬虫和本地后端，不更新线上 Azure 后端。",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="只验证目标数据库，不修改任何配置。",
    )
    parser.add_argument(
        "--allow-data-mismatch",
        action="store_true",
        help="即使当前库和目标库的 jobs 数量不同也继续切换。",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    uri, parsed = load_database_uri(args.target)
    job_count = verify_database(uri)
    connection_string = build_npgsql_connection_string(parsed)
    active_target = read_active_target()
    active_count = job_count
    if active_target != args.target:
        active_uri, _ = load_database_uri(active_target)
        active_count = verify_database(active_uri)

    if args.dry_run:
        comparison = (
            ""
            if active_target == args.target
            else f"; 当前 {active_target} jobs={active_count}"
        )
        print(
            f"目标数据库验证成功: {args.target}; jobs={job_count}"
            f"{comparison}; "
            "未修改任何配置。"
        )
        return

    if active_count != job_count and not args.allow_data_mismatch:
        raise RuntimeError(
            f"拒绝切换：当前 {active_target} 有 {active_count} 条 jobs，"
            f"目标 {args.target} 有 {job_count} 条。请先同步数据库；"
            "如明确接受数据差异，可使用 --allow-data-mismatch。"
        )

    if not args.local_only:
        update_online_backend(connection_string)
        verify_online_backend(job_count)

    update_local_configuration(args.target, connection_string)
    scope = "本地与线上后端" if not args.local_only else "仅本地"
    print(f"数据库已切换到 {args.target}: jobs={job_count}; 范围={scope}。")


if __name__ == "__main__":
    main()
