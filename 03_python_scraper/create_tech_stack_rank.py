from collections import Counter
import pandas as pd
from connect import get_conn
from psycopg2.extras import execute_values


# 从 jobs 表中读取所有技术标签
def load_tags(level='all'):
    conn = get_conn()
    cur = conn.cursor()
    if level and level.lower() != 'all':
        sql = """
            SELECT tech_tags
            FROM jobs
            WHERE tech_tags IS NOT NULL
              AND job_level = %s
        """
        cur.execute(sql, (level,))
    else:
        sql = """
            SELECT tech_tags
            FROM jobs
            WHERE tech_tags IS NOT NULL
        """
        cur.execute(sql)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    all_tags = []
    for row in rows:
        tags = row[0].split(',')  # 假设逗号分隔
        tags = [t.strip().lower() for t in tags if t.strip()]
        all_tags.extend(tags)
    return all_tags




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

    total_jobs = cur.fetchone()[0]
    cur.close()
    conn.close()

    # 转成 DataFrame，计算百分比
    df = pd.DataFrame(tag_counter.items(), columns=['technology', 'Mentions'])
    df['Mentions'] = df['Mentions'].astype(int)
    df['Percentage'] = df['Mentions'] / total_jobs
    df['Category'] = df['technology'].map(category_map).fillna('Other')
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

conn.commit()
cur.close()
conn.close()