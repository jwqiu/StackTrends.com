import os
from pathlib import Path

import psycopg2


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SUPPORTED_DATABASES = {"aiven", "azure"}


def _load_database_url():
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if database_url:
        return database_url

    target = os.environ.get("STACKTREND_DATABASE", "").strip().lower()
    if not target:
        active_file = PROJECT_ROOT / "secrets" / "active_database.txt"
        if active_file.is_file():
            target = active_file.read_text(encoding="utf-8").strip().lower()
    if not target:
        target = "aiven"
    if target not in SUPPORTED_DATABASES:
        raise RuntimeError(
            f"不支持的数据库目标: {target}。可选值: aiven, azure。"
        )

    secret_file = PROJECT_ROOT / "secrets" / f"{target}_database_url.txt"
    if secret_file.is_file():
        database_url = secret_file.read_text(encoding="utf-8").strip()
        if database_url:
            return database_url

    raise RuntimeError(
        "缺少数据库连接信息。请设置 DATABASE_URL，或创建 "
        f"secrets/{target}_database_url.txt。"
    )


def get_conn():
    """
    获取数据库连接
    """
    try:
        conn = psycopg2.connect(_load_database_url(), connect_timeout=15)
        return conn
    except psycopg2.OperationalError as error:
        print("❌ 数据库连接失败，后续流程已终止。")
        print(f"PostgreSQL 原始错误: {error}")
        raise
    except Exception as error:
        print("❌ 创建数据库连接时发生未知错误，后续流程已终止。")
        print(f"原始错误: {error}")
        raise
