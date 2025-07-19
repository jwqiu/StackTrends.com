import sys
import os

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from collections import Counter
import pandas as pd
from python_scraper.connect import get_conn
from psycopg2.extras import execute_values


def load_tags(level=None, company_id=None):
    conn = get_conn()
    cur = conn.cursor()

    base_sql = "SELECT tech_tags FROM jobs WHERE tech_tags IS NOT NULL"
    params = []

    if level and level.lower() != 'all':
        base_sql += " AND job_level = %s"
        params.append(level)

    if company_id:
        base_sql += " AND company_id = %s"
        params.append(company_id)

    cur.execute(base_sql, tuple(params))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    all_tags = []
    for row in rows:
        tags = row[0].split(',')  # 逗号分隔
        tags = [t.strip().lower() for t in tags if t.strip()]
        all_tags.extend(tags)
    return all_tags



def create_tech_stack_rank():

    # 定义要处理的技术栈级别
    levels = ['all', 'Senior', 'Intermediate', 'Junior', 'Other']

    # 可选：从 tech_stacks_list 中查出每个 tech 的类别（Frontend、DevOps 等）
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT raw_keyword, category FROM tech_stacks_list")
    category_map = dict(cur.fetchall())
    cur.close()
    conn.close()

    all_dfs = []
    for level in levels:
        # 加载数据并统计词频
        tags = load_tags(level)
        tag_counter = Counter(tags)
        # 单独查job个数
        conn = get_conn()
        cur = conn.cursor()
        if level and level.lower() != 'all':
            cur.execute("SELECT COUNT(*) FROM jobs WHERE job_level = %s", (level,))
        else:
            cur.execute("SELECT COUNT(*) FROM jobs")

        total_jobs = cur.fetchone()[0] # type: ignore
        cur.close()
        conn.close()

        # 转成 DataFrame，计算百分比
        df = pd.DataFrame(tag_counter.items(), columns=['technology', 'Mentions'])
        df['Mentions'] = df['Mentions'].astype(int)
        df['Percentage'] = df['Mentions'] / total_jobs

        # （可选）先把映射表的 key 也转成小写，确保匹配成功
        category_map = {k.lower(): v for k, v in category_map.items()}

        # 先转小写再映射，找不到的填 'Other'
        df['Category'] = df['technology'].str.lower().map(category_map).fillna('Other')


        df['Job_Level'] = level
        all_dfs.append(df)

    final_df = pd.concat(all_dfs, ignore_index=True)

    # 最后保存到数据库（覆盖原表）
    conn = get_conn()
    cur = conn.cursor()

    # 丢掉旧表，重建时包含 job_level 列
    cur.execute("DROP TABLE IF EXISTS tech_stacks_frequency_count")
    cur.execute("""
        CREATE TABLE tech_stacks_frequency_count (
            job_level  TEXT,
            category   TEXT,
            technology TEXT,
            mentions   INTEGER,
            percentage NUMERIC
        )
    """)

    # 批量插入 final_df 中的所有行
    rows = [
        (
            row['Job_Level'],
            row['Category'],
            row['technology'],
            int(row['Mentions']),
            float(row['Percentage'])
        )
        for _, row in final_df.iterrows()
    ]

    execute_values(
        cur,
        """
        INSERT INTO tech_stacks_frequency_count
        (job_level, category, technology, mentions, percentage)
        VALUES %s
        """,
        rows
    )

    print("技术栈频率统计已更新到数据库。")

    conn.commit()
    cur.close()
    conn.close()


def create_tech_stack_rank_by_company():
    from collections import Counter
    import pandas as pd
    from psycopg2.extras import execute_values

    conn = get_conn()
    cur = conn.cursor()

    # 获取 top 20 公司
    cur.execute("""
        SELECT company_id, company_name
        FROM job_counts_by_company
        ORDER BY jobs_count DESC
        LIMIT 20
    """)
    top_companies = cur.fetchall()  # [(id1, name1), (id2, name2), ...]

    # 加载 tech → category 映射
    cur.execute("SELECT raw_keyword, category FROM tech_stacks_list")
    category_map = {k.lower(): v for k, v in cur.fetchall()}

    cur.close()
    conn.close()

    all_dfs = []

    for company_id, company_name in top_companies:
        # 加载该公司所有职位的 tags
        tags = load_tags(company_id=company_id)  # 你需要支持 company_id 参数
        tag_counter = Counter(tags)

        # 获取该公司职位总数
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM jobs WHERE company_id = %s", (company_id,))
        total_jobs = cur.fetchone()[0] # type: ignore
        cur.close()
        conn.close()

        # 计算频率 DataFrame
        df = pd.DataFrame(tag_counter.items(), columns=['technology', 'Mentions'])
        df['Mentions'] = df['Mentions'].astype(int)
        df['Percentage'] = df['Mentions'] / total_jobs

        df['Category'] = df['technology'].str.lower().map(category_map).fillna('Other')
        # 排序：Category 升序、Mentions 降序
        df = df.sort_values(['Category', 'Mentions'], ascending=[True, False])
        # 分组取每组前三
        df = df.groupby('Category', group_keys=False).head(3)

        df['Company_ID'] = company_id
        df['Company_Name'] = company_name

        all_dfs.append(df)

    final_df = pd.concat(all_dfs, ignore_index=True)

    # 保存结果表
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DROP TABLE IF EXISTS tech_stack_rank_by_company")
    cur.execute("""
        CREATE TABLE tech_stack_rank_by_company (
            company_id    BIGINT,
            company_name  TEXT,
            category      TEXT,
            technology    TEXT,
            mentions      INTEGER,
            percentage    NUMERIC
        )
    """)

    rows = [
        (
            row['Company_ID'],
            row['Company_Name'],
            row['Category'],
            row['technology'],
            int(row['Mentions']),
            float(row['Percentage'])
        )
        for _, row in final_df.iterrows()
    ]

    execute_values(
        cur,
        """
        INSERT INTO tech_stack_rank_by_company
        (company_id, company_name, category, technology, mentions, percentage)
        VALUES %s
        """,
        rows
    )

    print("按公司维度的技术栈排名已写入数据库。")
    conn.commit()
    cur.close()
    conn.close()

create_tech_stack_rank_by_company()