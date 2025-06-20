import pandas as pd
import re
from collections import Counter
import psycopg2
from connect import get_conn


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

raw_keywords, normalized_keywords = load_keywords()

# tech_keywords = [
#     # Frontend 框架
#     'angular', 'angular.js', 'angularjs', 'css', 'flutter', 'html', 'jquery', 'leaflet',
#     'next.js', 'nextjs', 'react', 'react native', 'reactjs', 'redux', 'svelte', 'sveltekit', 'tailwind',
#     'vue', 'vue.js', 'vuejs', 'xamarin', 'javascript', 'typescript', 'html5', 'css3', 'bootstrap', 'material ui', 'ant design', 'element ui',

#     # Backend 框架
#     '.net', '.net 5', '.net 6', '.net 7', '.net 8', '.net core', 'asp.net',
#     'django', 'express', 'fastapi', 'flask', 'laravel', 'node.js',
#     'spring', 'spring boot', 'c#', 'python', 'java', 'go', 'golang', 'c sharp', 'c-sharp', 'c# .net', 'c++', 'php', 'kotlin', 'swift', 'objectivec', 'objective-c',
#     'nodejs', 'node', 'graphql', 'ruby',

#     # Cloud_Platforms
#     'alibaba cloud', 'aws', 'aws cdk', 'azure', 'azure devops', 'cloudformation', 'gcp', 'google cloud', 'terraform', 'azure functions', 'azure data factory',

#     # Database / 数据库
#     'cassandra', 'cosmos db', 'databricks lakehouse', 'dbt', 'mongodb', 'mssql', 'mysql',
#     'nosql', 'oracle', 'postgres', 'postgresql', 'redis', 'snowflake', 'sql server', 'sqlite', 'spark',

#     # DevOps_tools
#     'ci/cd', 'cicd', 'cypress', 'docker', 'event-driven architecture', 'git', 'github', 'gitlab', 'jenkins',
#     'junit', 'kubernetes', 'linux', 'observability', 'playwright', 'powershell', 'bash', 'leaflet', 'streamsets'

#     # API
#     'api management', 'graphql', 'restful',

#     # Version_Control
#     'git', 'github', 'gitlab',

#     # Operating_System
#     'linux',

#     # Other
#     'ai tools', 'langchain', 'power apps', 'power automate', 'power bi', 'tensorflow', 'kafka', 'fabric'
# ]


# # 关键词归一化映射（变体 → 标准关键词）
# keyword_aliases = {
#     'c sharp': 'c#',
#     'c-sharp': 'c#',
#     'c# .net': 'c#',
#     'vue.js': 'vue',
#     'vuejs': 'vue',
#     'nextjs': 'next.js',
#     'reactjs': 'react',
#     'angularjs': 'angular',
#     'angular.js': 'angular',
#     'postgres': 'postgresql',
#     'mssql': 'sql server',
#     'golang': 'go',
#     'objectivec': 'objective-c',
#     'ci/cd': 'cicd',
#     'nodejs': 'node.js',     # 反向归一（可选）
#     'html5': 'html',         # 可选向前归一
#     'css3': 'css',           # 同上
#     'react native': 'react',  # 如果你想合并统计 React，可开启此行
#     '.net core': '.net',
#     '.net 5': '.net',
#     '.net 6': '.net',
#     '.net 7': '.net',
#     '.net 8': '.net',

# }

def load_job_data():
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs")
    rows = cursor.fetchall()
    colnames = [desc[0] for desc in cursor.description]  # 获取列名
    cursor.close()
    conn.close()
    return pd.DataFrame(rows, columns=colnames) 

# 读取 Excel
# df = pd.read_excel('job_list_with_details.xlsx')  # 假设有 'Job Description' 列

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



# 排序并打印统计
# sorted_tech = tech_counter.most_common()
# print("技术关键词出现频率：")
# for tech, count in sorted_tech:
#     print(f"{tech}: {count}")

# 保存新的 Excel 文件
# df.to_excel('jobs_with_tech_tags.xlsx', index=False)

def update_tech_tags(df):
    conn = get_conn()
    cursor = conn.cursor()

    for _, row in df.iterrows():
        job_id = row['job_id']
        tech_tags = row['Tech Tags']
        cursor.execute(
            "UPDATE jobs SET tech_tags = %s WHERE job_id = %s",
            (tech_tags, job_id)
        )

    conn.commit()
    cursor.close()
    conn.close()

update_tech_tags(df)