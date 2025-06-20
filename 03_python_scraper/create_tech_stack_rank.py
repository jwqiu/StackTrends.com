from collections import Counter
import pandas as pd
from connect import get_conn

# 从 jobs 表中读取所有技术标签
def load_all_tags():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT tech_tags FROM jobs WHERE tech_tags IS NOT NULL")
    rows = cur.fetchall()
    cur.close()
    conn.close()

    all_tags = []
    for row in rows:
        tags = row[0].split(',')  # 假设逗号分隔
        tags = [t.strip().lower() for t in tags if t.strip()]
        all_tags.extend(tags)
    return all_tags

# 加载数据并统计词频
tags = load_all_tags()
tag_counter = Counter(tags)

# 单独查job个数
conn = get_conn()
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM jobs")
total_jobs = cur.fetchone()[0]
cur.close()
conn.close()


# 转成 DataFrame，计算百分比
df = pd.DataFrame(tag_counter.items(), columns=['technology', 'Mentions'])
df['Mentions'] = df['Mentions'].astype(int)
df['Percentage'] = df['Mentions'] / total_jobs

# 可选：从 tech_stacks_list 中查出每个 tech 的类别（Frontend、DevOps 等）
conn = get_conn()
cur = conn.cursor()
cur.execute("SELECT raw_keyword, category FROM tech_stacks_list")
category_map = dict(cur.fetchall())
cur.close()
conn.close()

df['Category'] = df['technology'].map(category_map).fillna('Other')

# 最后保存到数据库（覆盖原表）
conn = get_conn()
cur = conn.cursor()

cur.execute("DROP TABLE IF EXISTS tech_stacks_frequency_count")
cur.execute("""
    CREATE TABLE tech_stacks_frequency_count (
        technology TEXT,
        category TEXT,
        mentions INTEGER,
        percentage NUMERIC
    )
""")

for _, row in df.iterrows():
    # percentage = round(row['Percentage'] * 100, 2)  # 转换为百分比并保留两位小数
    cur.execute(
        "INSERT INTO tech_stacks_frequency_count (technology, category, mentions, percentage) VALUES (%s, %s, %s, %s)",
        (row['technology'], row['Category'], row['Mentions'], row['Percentage'])
    )

conn.commit()
cur.close()
conn.close()
