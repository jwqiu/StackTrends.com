import pandas as pd
import re
from collections import Counter


tech_keywords = [
    # 编程语言
    'python', 'java', 'c#', 'javascript', 'typescript', 'go', 'ruby', 'golang',
    'c sharp', 'c-sharp', 'c# .net', 'c++', 'php', 'kotlin', 'swift', 'objectivec', 'bash', 'powershell',  # ← 新增

    # 前端框架
    'react', 'vue', 'angular', 'next.js', 'flutter', 'vue.js', 'nextjs', 'vuejs', 'xamarin', 'angularjs', 'angular.js', 'html', 'css',
    'reactjs', 'react native', 'svelte', 'sveltekit', 'tailwind', 'redux', 'leaflet', 'graphql', 'jquery',  # ← 新增

    # 后端框架
    'flask', 'django', 'spring', 'express', 'fastapi',
    '.net', 'node.js', '.net core', '.net 5', '.net 6', '.net 7', '.net 8', 'asp.net',
    'spring boot', 'azure functions', 'api management', 'laravel', 'databricks',  # ← 新增

    # 云平台
    'aws', 'azure', 'gcp', 'google cloud', 'alibaba cloud',
    'terraform', 'cloudformation', 'aws cdk', 'azure devops',  # ← 新增

    # 数据库
    'mysql', 'postgresql', 'oracle', 'mongodb', 'redis', 'sqlite', 'postgres',
    'sql server', 'mssql', 'nosql', 'snowflake', 'cosmos db', 'cassandra', 'databricks lakehouse', 'fabric', 'dbt', 'streamsets',  # ← 新增

    # DevOps / 工具
    'docker', 'kubernetes', 'jenkins', 'git', 'github', 'gitlab',
    'ci/cd', 'linux', 'observability', 'event-driven architecture', 'junit', 'cypress', 'playwright',  # ← 新增

    # 其他技术
    'graphql', 'restful', 'kafka', 'spark',
    'power bi', 'power apps', 'power automate', 'azure data factory', 'ai tools', 'tensorflow', 'langchain',  # ← 新增
]

# 关键词归一化映射（变体 → 标准关键词）
keyword_aliases = {
    'c sharp': 'c#',
    'c-sharp': 'c#',
    'c# .net': 'c#',
    'vue.js': 'vue',
    'vuejs': 'vue',
    'nextjs': 'next.js',
    'reactjs': 'react',
    'angularjs': 'angular',
    'angular.js': 'angular',
    'postgres': 'postgresql',
    'mssql': 'sql server',
    'golang': 'go',
    'objectivec': 'objective-c',
    'ci/cd': 'cicd',
    'nodejs': 'node.js',     # 反向归一（可选）
    'html5': 'html',         # 可选向前归一
    'css3': 'css',           # 同上
    'react native': 'react',  # 如果你想合并统计 React，可开启此行
    '.net core': '.net',
    '.net 5': '.net',
    '.net 6': '.net',
    '.net 7': '.net',
    '.net 8': '.net',

}



# 读取 Excel
df = pd.read_excel('job_list_with_details.xlsx')  # 假设有 'Job Description' 列

# 统一小写处理、去除空值
df['job_des'] = df['job_des'].fillna('').str.lower()

# 初始化统计器
tech_counter = Counter()
job_labels = []

# 遍历每条 job description
for desc in df['job_des']:
    found = []
    for keyword in tech_keywords:
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
            normalized_keyword = keyword_aliases.get(keyword, keyword)

            if normalized_keyword not in found:
                found.append(normalized_keyword)
                tech_counter[normalized_keyword] += 1

    job_labels.append(', '.join(found))
# 加入标签列
df['Tech Tags'] = job_labels

# 排序并打印统计
sorted_tech = tech_counter.most_common()
print("技术关键词出现频率：")
for tech, count in sorted_tech:
    print(f"{tech}: {count}")

# 保存新的 Excel 文件
df.to_excel('jobs_with_tech_tags.xlsx', index=False)
