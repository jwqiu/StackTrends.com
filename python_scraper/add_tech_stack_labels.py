import pandas as pd
import re
from collections import Counter
from .connect import get_conn


def load_keywords():
    """
    load tech stack keywords from the database
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
        if normalized_kw:        
        # if normalized_kw and normalized_kw.strip() != raw_kw.strip():
            normalized_keywords[raw_kw.strip().lower()] = normalized_kw.strip()
            # normalized_keywords[raw_kw.strip().lower()] = normalized_kw.strip().lower()

    # raw_keywords is a set of all unique raw keywords
    # normalized_keywords is a dict mapping raw keyword to normalized keyword
    return raw_keywords, normalized_keywords

# load only newly added jobs that don't have tech stack tags assigned yet
# however, there is an issue here: if we update the rules for assigning tech stack tags,
# we may also need to reprocess old job data to ensure consistency, but this code skips
# existing jobs whose tech_tags value has already been set (so it runs faster)
# so it won't apply the new logic to historical data unless we change it to load all jobs every time
def load_job_data():
    conn = get_conn()
    cursor = conn.cursor()
    # cursor.execute("SELECT * FROM jobs")
    cursor.execute("SELECT * FROM jobs WHERE tech_tags IS NULL")

    rows = cursor.fetchall()
    colnames = [desc[0] for desc in cursor.description]  # 获取列名 # type: ignore
    cursor.close()
    conn.close()
    # return a pandas dataframe
    return pd.DataFrame(rows, columns=colnames) 

# update only the tech_tags column in the database
def update_tech_tags(df):
    conn = get_conn()
    cursor = conn.cursor()

    for _, row in df.iterrows():
        job_id    = row['job_id']
        tech_tags = row['Tech Tags']
        cursor.execute(
            """
            UPDATE jobs
               SET tech_tags = %s
             WHERE job_id = %s
            """,
            (tech_tags, job_id)
        )

    conn.commit()
    cursor.close()
    conn.close()

def add_tech_stack_labels():
    raw_keywords, normalized_keywords = load_keywords()

    df=load_job_data()
    df['job_des'] = df['job_des'].fillna('').str.lower()

    tech_counter = Counter()
    job_labels = []

    # we loop through each job description and check whether each keyword appears in it
    for desc in df['job_des']:
        found = []
        for keyword in raw_keywords:
            match_found = False

            # if a keyword contains special characters, like c++, .net, we do a simple substring match
            is_special = any(sym in keyword for sym in ['#', '+', '.', '-', ' '])

            if is_special:
                if keyword in desc:
                    match_found = True
            # otherwise, we use a regex word boundary match to avoid partial matches
            else:
                if re.search(r'\b' + re.escape(keyword) + r'\b', desc):
                    match_found = True

            if match_found:
                # use the normalized version if it exists, otherwise use the raw keyword
                # the first keyword in get() is the lookup key and the second is the fallback value if not found
                final_keyword = normalized_keywords.get(keyword, keyword)

                if final_keyword not in found:
                    found.append(final_keyword)
                    tech_counter[final_keyword] += 1

        job_labels.append(', '.join(found))
    # add the tags column
    df['Tech Tags'] = job_labels

    # 最后调用
    update_tech_tags(df)
    print("技术栈标签已更新到数据库。")

