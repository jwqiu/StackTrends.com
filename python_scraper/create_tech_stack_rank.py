import sys
import os
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from collections import Counter
import pandas as pd
from .connect import get_conn
from psycopg2.extras import execute_values
from datetime import datetime

# load tech tags from jobs table with optional filter
def load_tags(level=None, company_id=None, month=None):
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

    if month:
        base_sql += " AND listing_year_month = %s"
        params.append(month)

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

    # Define the tech stack levels to process
    levels = ['all', 'Senior', 'Intermediate', 'Junior', 'Other']

    # fetch each tech's category (Frontend, DevOps, etc.) from tech_stacks_list
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT raw_keyword, category FROM tech_stacks_list")
    category_map = dict(cur.fetchall())
    cur.close()
    conn.close()

    all_dfs = []
    for level in levels:
        # count tech tags frequencies for this level
        tags = load_tags(level)
        tag_counter = Counter(tags)
        # count the number of jobs at this level so we can compute percentages
        conn = get_conn()
        cur = conn.cursor()
        if level and level.lower() != 'all':
            cur.execute("SELECT COUNT(*) FROM jobs WHERE job_level = %s", (level,))
        else:
            cur.execute("SELECT COUNT(*) FROM jobs")

        total_jobs = cur.fetchone()[0] # type: ignore
        cur.close()
        conn.close()

        # convert the counter to a dataframe for easier processing later
        df = pd.DataFrame(tag_counter.items(), columns=['technology', 'Mentions'])
        df['Mentions'] = df['Mentions'].astype(int) # convert to int
        # create percentage column by dividing mentions by total jobs for each row
        df['Percentage'] = df['Mentions'] / total_jobs

        # convert all keys in category_map to lowercase for case-insensitive matching
        category_map = {k.lower(): v for k, v in category_map.items()}

        # map each technology to its category using category_map, convert to lowercase before mapping, fill missing with 'Other'
        df['Category'] = df['technology'].str.lower().map(category_map).fillna('Other')

        # add one more column to indicate the job level for this dataframe
        df['Job_Level'] = level
        all_dfs.append(df)

    # combine all levels' dataframes into one
    final_df = pd.concat(all_dfs, ignore_index=True)

    # Finally save to database (overwrite the original table)
    conn = get_conn()
    cur = conn.cursor()

    # Drop old table, recreate with job_level column
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
    # rows = [
    #     (
    #         row['Job_Level'],
    #         row['Category'],
    #         row['technology'],
    #         int(row['Mentions']),
    #         float(row['Percentage'])
    #     )
    #     for _, row in final_df.iterrows()
    # ]

    # build a list of tuples to be used as parameters for the SQL insert
    rows = []
    for _, row in final_df.iterrows():
        job_level = row['Job_Level']
        category = row['Category']
        technology = row['technology']
        mentions = int(row['Mentions'])
        percentage = float(row['Percentage'])
        rows.append((job_level, category, technology, mentions, percentage)) # this is a tuple, which is immutable

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

def update_job_counts_by_company():
    """
    刷新 job_counts_by_company 表，统计每家公司职位总数
    """
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("TRUNCATE TABLE job_counts_by_company")
    cur.execute("""
        INSERT INTO job_counts_by_company (company_id, company_name, jobs_count)
        SELECT 
            company_id, 
            company_name, 
            COUNT(*) AS jobs_count
        FROM jobs
        GROUP BY company_id, company_name
        ORDER BY jobs_count DESC
    """)
    conn.commit()
    cur.close()
    conn.close()
    print("job_counts_by_company表已刷新。")

# TODO: do not drop the table every time, just update it
def create_tech_stack_rank_by_company():

    conn = get_conn()
    cur = conn.cursor()

    update_job_counts_by_company()

    # filter those companies with more than 10 jobs
    cur.execute("""
        SELECT company_id, company_name
        FROM job_counts_by_company
        WHERE jobs_count > 10
        ORDER BY jobs_count DESC
    """)
    top_companies = cur.fetchall()  # [(id1, name1), (id2, name2), ...]

    # fetch all (raw_keyword, category) rows and build a dictionary for mapping
    # convert raw_keyword to lowercase for safe mapping later
    cur.execute("SELECT raw_keyword, category FROM tech_stacks_list")
    # category_map = {k.lower(): v for k, v in cur.fetchall()}
    category_map = {}
    for k, v in cur.fetchall():
        category_map[k.lower()] = v

    cur.close()
    conn.close()

    all_dfs = []

    for company_id, company_name in top_companies:
        # load tech tags for this company
        tags = load_tags(company_id=company_id)  
        tag_counter = Counter(tags)

        # get total job count for this company
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM jobs WHERE company_id = %s", (company_id,))
        total_jobs = cur.fetchone()[0] # type: ignore
        cur.close()
        conn.close()

        # count tech frequencies and compute percentages
        df = pd.DataFrame(tag_counter.items(), columns=['technology', 'Mentions'])
        df['Mentions'] = df['Mentions'].astype(int)
        df['Percentage'] = df['Mentions'] / total_jobs

        df['Category'] = df['technology'].str.lower().map(category_map).fillna('Other')
        # sort by Category ascending, Mentions descending
        df = df.sort_values(['Category', 'Mentions'], ascending=[True, False])
        # only keep top 5 technologies per category
        df = df.groupby('Category', group_keys=False).head(5)

        # assign company info values to the whole column, not row by row
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

def update_landing_summary():
    conn = get_conn()
    cur = conn.cursor()

    # count total jobs, companies, keywords
    cur.execute("SELECT COUNT(*) FROM public.jobs")
    result = cur.fetchone()
    jobs_count = result[0] if result else 0

    cur.execute("SELECT COUNT(DISTINCT company_id) FROM public.jobs")
    result = cur.fetchone()
    company_count = result[0] if result else 0

    cur.execute("SELECT COUNT(raw_keyword) FROM public.tech_stacks_list")
    result = cur.fetchone()
    keyword_count = result[0] if result else 0

    # unlike other functions, we do not drop the table here but just insert a new row
    # there is one more column in the database called updated_at with default value as current timestamp, so we do not need to insert it here
    # when we use the data later, we just pick the latest row based on updated_at
    cur.execute("""
        INSERT INTO landing_summary (jobs_count, company_count, keyword_count)
        VALUES (%s, %s, %s)
    """, (jobs_count, company_count, keyword_count))

    conn.commit()
    cur.close()
    conn.close()

    print("✅ landing_summary 数据已更新。")

# the functions below are not in use right now
# generate months from 2025-06 to last month
def generate_months():
    months = pd.period_range(
        start="2025-06",
        end=(datetime.today().replace(day=1) - pd.DateOffset(months=1)),
        freq="M"
    ).strftime("%Y/%m").tolist()
    return months

def get_top_growing_and_declining_techs():
    months=generate_months()

    conn = get_conn()
    cur = conn.cursor()

    records=[]

    for month in months:

        # 1. 获取 tags
        tags=load_tags(month=month)
        tag_counter = Counter(tags)

        # 2. 获取当月 jobs_count
        cur.execute("SELECT jobs_count FROM public.jobs_count_by_month WHERE listing_year_month = %s", (month,))
        result = cur.fetchone()
        job_number_this_month = result[0] if result else 0
        
        # 3. 计算 mention rate
        for tech, count in tag_counter.items():
            mention_rate = count / job_number_this_month if job_number_this_month > 0 else 0
            records.append({
                "month": month,
                "tech": tech,
                "count": count,
                "jobs_count": job_number_this_month,
                "mention_rate": mention_rate
            })
            
    df = pd.DataFrame(records)

    first_month = df["month"].min()
    last_month = df["month"].max()

    df_first = df[df["month"] == first_month][["tech", "mention_rate"]].rename(columns={"mention_rate": "first_rate"})
    df_last = df[df["month"] == last_month][["tech", "mention_rate"]].rename(columns={"mention_rate": "last_rate"})

    # 只保留两个月都出现的 tech
    df_compare = pd.merge(df_first, df_last, on="tech", how="inner")

    # 计算变化
    df_compare["rate_change"] = df_compare["last_rate"] - df_compare["first_rate"]

    # 取 top 10 增长和 top 10 降低
    top_growing = df_compare.sort_values("rate_change", ascending=False).head(10)
    top_growing["trend_type"] = "growing"
    top_declining = df_compare.sort_values("rate_change", ascending=True).head(10)
    top_declining["trend_type"] = "declining"

    # 在原始 df 中筛出这 20 个 tech 每个月的数据
    selected_techs = pd.concat([top_growing, top_declining], ignore_index=True)

    df_selected = df[df["tech"].isin(selected_techs["tech"])]
    df_selected = df_selected.merge(
        selected_techs[["tech", "trend_type"]],
        on="tech",
        how="left"
    )

     # 1. 建表
    cur.execute("""
        CREATE TABLE IF NOT EXISTS top_growing_and_declining_techs (
            month TEXT,
            tech TEXT,
            mention_rate DOUBLE PRECISION,
            count INTEGER,
            jobs_count INTEGER,
            trend_type TEXT
        )
    """)

    # 2. 清空表
    cur.execute("TRUNCATE TABLE top_growing_and_declining_techs")

    # 3. 插入数据
    insert_sql = """
        INSERT INTO top_growing_and_declining_techs (month, tech, mention_rate, count, jobs_count, trend_type)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    for _, row in df_selected.iterrows():
        cur.execute(insert_sql, (
            row["month"],
            row["tech"],
            float(row["mention_rate"]),
            int(row["count"]),
            int(row["jobs_count"]),
            row["trend_type"]
        ))

    print("top_growing_and_declining_techs 表已更新。")
    conn.commit()
    cur.close()
    conn.close()

