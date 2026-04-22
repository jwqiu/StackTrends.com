import pandas as pd
import re
from collections import Counter
import psycopg2
from .connect import get_conn

def load_job_data():
    conn = get_conn()
    cursor = conn.cursor()
    # cursor.execute("SELECT job_id, job_des, year_of_experience FROM jobs")
    cursor.execute("SELECT job_id, job_des, year_of_experience FROM jobs WHERE job_level IS NULL or job_level =''")

    rows = cursor.fetchall()
    colnames = [desc[0] for desc in cursor.description]  # 获取列名 # type: ignore
    cursor.close()
    conn.close()
    # return a pandas dataframe
    return pd.DataFrame(rows, columns=colnames) 


def extract_single_yoe_from_text(text, window_size=10):
    """
    Return the YOE number only when:
    - a job_des may contain multiple 'year' / 'years'
    - among all these 'year' keywords, exactly one of them has a number 1-10
      within +/- window_size characters
    - and that matched year keyword has only one valid number in its window

    Otherwise return None.
    """
    if not text:
        return None

    text = text.lower()
    matched_year_keywords = []

    for match in re.finditer(r'\byears?\b', text):
        start, end = match.span()

        left_part = text[max(0, start - window_size):start]
        right_part = text[end:min(len(text), end + window_size)]
        window_text = left_part + " " + right_part

        nums = re.findall(r'\b(10|[1-9])\b', window_text)

        # 只有这个 year 附近恰好一个数字，才算这个 year 命中
        if len(nums) == 1:
            matched_year_keywords.append(int(nums[0]))

        # 如果这个 year 附近有多个数字，直接视为这个 year 不可靠，不加入
        # 这里不用 else，默认跳过

    # 整个 job_des 中，恰好只有一个 year keyword 命中，才返回
    if len(matched_year_keywords) == 1:
        return matched_year_keywords[0]

    return None


def update_year_of_experience():
    df = load_job_data()

    conn = get_conn()
    cursor = conn.cursor()

    for _, row in df.iterrows():
        job_id = row["job_id"]
        job_des = row["job_des"]

        yoe = extract_single_yoe_from_text(job_des, window_size=10)

        if yoe is not None:
            cursor.execute(
                """
                UPDATE jobs
                SET year_of_experience = %s
                WHERE job_id = %s
                """,
                (yoe, job_id)
            )

    conn.commit()
    cursor.close()
    conn.close()

