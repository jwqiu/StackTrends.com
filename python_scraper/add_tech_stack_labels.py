import pandas as pd
import re
from collections import Counter
import psycopg2
from .connect import get_conn


def load_keywords():
    """
    从数据库加载技术关键词
    """
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT raw_keyword,normalized_keyword FROM tech_stacks_list")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    raw_keywords = set()
    normalized_keywords = {}

    for raw_kw, normalized_kw in rows:
        if raw_kw:
            raw_keywords.add(raw_kw.strip().lower())
        if normalized_kw and normalized_kw.strip().lower() != raw_kw.strip().lower():
            normalized_keywords[raw_kw.strip().lower()] = normalized_kw.strip().lower()

    return raw_keywords, normalized_keywords


def load_job_data():
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs WHERE job_level IS NULL or job_level =''")
    rows = cursor.fetchall()
    colnames = [desc[0] for desc in cursor.description]  # 获取列名 # type: ignore
    cursor.close()
    conn.close()
    return pd.DataFrame(rows, columns=colnames) 

def label_job_level(title, description=None):
    """
    根据职位 title 和 job description 共同判断岗位级别。
    优先使用 title；如果 title 未命中，则尝试在 description 中匹配。
    如果两者冲突，以 title 为准。
    """
    def match_level(text, senior_kw, inter_kw, junior_kw):
        if not isinstance(text, str):
            return None
        text = text.lower()

        if any(k in text for k in senior_kw):
            return 'Senior'
        elif any(k in text for k in inter_kw):
            return 'Intermediate'
        elif any(k in text for k in junior_kw):
            return 'Junior'
        else:
            return None

    # 定义关键词
    title_senior = ['senior', 'lead', 'principal', 'architect', 'head', 'manager','architecture']
    title_intermediate = ['intermediate', 'mid-level', 'mid level', 'midlevel','experienced']
    title_junior = ['junior', 'graduate', 'internship', 'entry-level', 'intern', 'entry level', 'entrylevel', 'associate']

    # des_senior = ['senior', 'lead', 'principal', 'head', 'architecture']
    des_senior = ['senior']
    # des_intermediate = ['intermediate', 'mid-level', 'mid level', 'midlevel', 'experienced']
    # des_junior = ['junior', 'graduate', 'internship', 'entry-level', 'entry level', 'entrylevel', 'associate']
    des_intermediate = []
    des_junior = []

    # 1️⃣ 先判断 title
    title_level = match_level(title, title_senior, title_intermediate, title_junior)

    # 2️⃣ 如果 title 没命中，再判断 description
    des_level = None
    if description:
        des_level = match_level(description, des_senior, des_intermediate, des_junior)

    # 3️⃣ 以 title 为准，description 仅作补充
    if title_level:
        return title_level
    elif des_level:
        return des_level
    else:
        return 'Other'


def update_tech_tags_and_levels(df):
    conn = get_conn()
    cursor = conn.cursor()

    for _, row in df.iterrows():
        job_id    = row['job_id']
        tech_tags = row['Tech Tags']
        job_level = row['job_level']

        cursor.execute(
            """
            UPDATE jobs
               SET tech_tags = %s,
                   job_level = %s
             WHERE job_id = %s
            """,
            (tech_tags, job_level, job_id)
        )

    conn.commit()
    cursor.close()
    conn.close()


def add_tech_stack_labels():
    raw_keywords, normalized_keywords = load_keywords()

    df=load_job_data()
    # 统一小写处理、去除空值
    df['job_des'] = df['job_des'].fillna('').str.lower()

    # 初始化统计器
    tech_counter = Counter()
    job_labels = []

    # 遍历每条 job description
    for desc in df['job_des']:
        found = []
        for keyword in raw_keywords:
            match_found = False

            # 判断是否是需要特殊处理的符号关键词（如 .net、c#）
            is_special = any(sym in keyword for sym in ['#', '+', '.', '-', ' '])

            if is_special:
                if keyword in desc:
                    match_found = True
            else:
                if re.search(r'\b' + re.escape(keyword) + r'\b', desc):
                    match_found = True

            if match_found:
                final_keyword = normalized_keywords.get(keyword, keyword)

                if final_keyword not in found:
                    found.append(final_keyword)
                    tech_counter[final_keyword] += 1

        job_labels.append(', '.join(found))
    # 加入标签列
    df['Tech Tags'] = job_labels

    # df['job_level'] = df['job_title'].apply(label_job_level)
    levels = []
    for i, row in df.iterrows():
        level = label_job_level(row['job_title'], row['job_des'])
        levels.append(level)

    df['job_level'] = levels

    # 最后调用
    update_tech_tags_and_levels(df)
    print("技术栈和工作经验级别的标签已更新到数据库。")



