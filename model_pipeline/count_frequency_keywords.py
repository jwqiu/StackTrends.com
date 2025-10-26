from python_scraper.connect import get_conn
import re
from collections import Counter
import pandas as pd


def load_job_data():
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs")
    rows = cursor.fetchall()
    if cursor.description is None:
        raise ValueError("No results returned. Check your SQL or table name.")

    colnames = [desc[0] for desc in cursor.description]
    cursor.close()
    conn.close()
    return pd.DataFrame(rows, columns=colnames) 


# -------- 新增词频统计函数 -------- #
# def get_top_words_by_level(df, text_col='job_des', level_col='job_level', topn=100):
#     """
#     对每个job_level的所有job_des进行分词统计，输出每个级别的TopN高频词
#     """
#     results = {}

#     # 确保文本是小写
#     df[text_col] = df[text_col].fillna('').str.lower()

#     # 循环每个类别（senior, junior, intermediate）
#     for level, group in df.groupby(level_col):
#         all_text = ' '.join(group[text_col].tolist())

#         # 提取英文单词（长度>=3），过滤掉符号、短词
#         words = re.findall(r'\b[a-z]{3,}\b', all_text)

#         # 统计词频
#         counter = Counter(words)
#         top_words = counter.most_common(topn)

#         results[level] = pd.DataFrame(top_words, columns=['word', 'count'])

#     return results


# -------- 主执行函数 -------- #
# if __name__ == "__main__":
#     df = load_job_data()
#     results = get_top_words_by_level(df)

#     # 只取出三个常见级别（可根据实际调整）
#     levels = ['Junior', 'Intermediate', 'Senior']
#     levels = [lvl for lvl in levels if lvl in results]

#     # -------- 去重逻辑：保留每个级别独有词 -------- #
#     # 1️⃣ 先取出所有集合
#     word_sets = {lvl: set(results[lvl]['word']) for lvl in levels}

#     # 2️⃣ 找出各自独有的词
#     unique_words = {}
#     for lvl in levels:
#         others = set().union(*[word_sets[o] for o in levels if o != lvl])
#         unique_words[lvl] = word_sets[lvl] - others

#     # 3️⃣ 过滤原结果，只保留独有词
#     unique_results = {}
#     for lvl in levels:
#         df_lvl = results[lvl]
#         df_unique = df_lvl[df_lvl['word'].isin(unique_words[lvl])]
#         unique_results[lvl] = df_unique.reset_index(drop=True)

#     # -------- 合并并输出 -------- #
#     merged = pd.DataFrame()
#     for lvl in levels:
#         table = unique_results[lvl].copy()
#         table.columns = [f"{lvl}_word", f"{lvl}_count"]
#         merged = pd.concat([merged, table], axis=1)

#     print("\n=== Unique Top Words Comparison Across Job Levels ===")
#     print(merged.to_string(index=False))



def count_jobs(level='Other'):
    df = load_job_data()
    df = df[df['job_level'] == level].copy()

    total_jobs = len(df)

    # 分句规则：按句号、问号、感叹号、分号、冒号或换行符切分
    SENT_SPLIT = re.compile(r'(?<=[.!?;:\n])\s*')

    # 匹配规则：
    # 1) salary + $
    # 2) experience + 数字
    pattern_salary = re.compile(r'(?=.*\bsalary\b)(?=.*\$)', re.IGNORECASE)
    pattern_experience = re.compile(r'(?=.*\bexperience\b)(?=.*\d)', re.IGNORECASE)

    match_count = 0
    matched_sentences = []

    for _, row in df.iterrows():
        des = str(row['job_des'])
        # 先粗分
        sentences = [s.strip() for s in SENT_SPLIT.split(des) if s.strip()]

        # 如果句子超过100个单词，再按逗号进一步细分
        refined_sentences = []
        for s in sentences:
            if len(s.split()) > 100:
                refined_sentences.extend([x.strip() for x in re.split(r'(?<=,)\s*', s) if x.strip()])
            else:
                refined_sentences.append(s)
        sentences = refined_sentences

        # 检查是否匹配 salary+$ 或 experience+数字
        if any(pattern_salary.search(s) or pattern_experience.search(s) for s in sentences):
            match_count += 1
            matched_sentences.extend([
                s for s in sentences
                if pattern_salary.search(s) or pattern_experience.search(s)
            ])

    # 输出结果
    print(f"\n📊 Level: {level}")
    print(f"Total jobs: {total_jobs}")
    print(f"Jobs mentioning salary+$ or experience+number: {match_count}")
    print(f"Ratio: {match_count / total_jobs * 100:.2f}%")

    if match_count > 0:
        print("\nExamples:")
        for s in matched_sentences[:10]:
            print(" -", s)

# 示例：查询 “Other” level 中包含 “salary” 和数字的职位
count_jobs(level='Other')

# 你也可以改成：
# count_jobs(level='Other', keyword='experience')