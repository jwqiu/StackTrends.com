from python_scraper.connect import get_conn
import re
from collections import Counter
import pandas as pd


def load_job_data():
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs")
    rows = cursor.fetchall()
    # cursor.description stores metadata about the query result
    # it clearly describes what the query result looks like in terms of columns
    if cursor.description is None:
        raise ValueError("No results returned. Check your SQL or table name.")

    # [] in python represents a list, but in Javascript and C#, it represents an array
    # {} in python represents a dictionary, but in Javascript and C#, it represents an object
    # colnames = [desc[0] for desc in cursor.description]
    colnames = []
    for desc in cursor.description:
        colnames.append(desc[0])
    cursor.close()
    conn.close()
    return pd.DataFrame(rows, columns=colnames) 

# this function extracts top N words from job descriptions grouped by job level
def get_top_words_by_level(df, text_col='job_des', level_col='job_level', topn=100):

    results = {}

    # preprcessing, convert all text to lowercase
    df[text_col] = df[text_col].fillna('').str.lower()
    # group by job level, groups is just a temporary intermediate object that we use in the following computation
    groups = df.groupby(level_col)

    # the level here represents job level like 'Junior', 'Intermediate', 'Senior'
    # the group here represents the sub-dataframe corresponding to that job level
    for level, group in groups:
        # group[text_col] here is a pandas series object representing all job descriptions under that job level
        # convert it to a list of strings because we need to combine them into one big string for word frequency counting
        texts = group[text_col].tolist()
        all_text = ''.join(texts)

        # Extract English words (length >= 3) into a list, filter out symbols and short words
        words = re.findall(r'\b[a-z]{3,}\b', all_text)

        # Count unique words frequency
        counter = Counter(words)
        top_words = counter.most_common(topn)

        # result is a dictionary, the key is job level, and the value is a dataframe of top words and their counts
        results[level] = pd.DataFrame(top_words, columns=['word', 'count'])

    return results


if __name__ == "__main__":
    df = load_job_data()
    results = get_top_words_by_level(df)

    # keep only levels that exist in the results
    levels = ['Junior', 'Intermediate', 'Senior']
    # cause results is a dict, so for lvl in results means for lvl in results.keys()
    levels = [lvl for lvl in levels if lvl in results]

    # word_sets = {lvl: set(results[lvl]['word']) for lvl in levels}
    # remove duplicated words for each level and store them in a new dict, the key is level, and the value is a set of words(removed duplicates)
    word_sets = {}
    for lvl in levels: 
        words = results[lvl]['word']
        word_sets[lvl] = set(words)

    # find unique words for each level
    unique_words = {}
    for lvl in levels:
        # get current level's words
        current_words = word_sets[lvl]
        # get all other levels' words             
        all_other_words = set().union(*(word_sets[o] for o in levels if o != lvl))
        # minus operation to get unique words for the current level
        unique_words[lvl] = current_words - all_other_words

    # we already have unique words for each level, now we need to filter the original results so we will get both unique words and their counts
    unique_results = {}
    for lvl in levels:
        df_lvl = results[lvl]
        df_unique = df_lvl[df_lvl['word'].isin(unique_words[lvl])]
        unique_results[lvl] = df_unique.reset_index(drop=True)

    # merge all unique results into one dataframe for easy comparison
    merged = pd.DataFrame()
    for lvl in levels:
        table = unique_results[lvl].copy()
        table.columns = [f"{lvl}_word", f"{lvl}_count"]
        merged = pd.concat([merged, table], axis=1)

    print("\n=== Unique Top Words Comparison Across Job Levels ===")
    print(merged.to_string(index=False))


# count how many job descriptions mention salary or experience with numbers
# this is a rough analysis before conducting more advanced NLP techniques
def count_jobs(level='Other'):
    # load job data and copy only rows with specified level
    df = load_job_data()
    df = df[df['job_level'] == level].copy()

    total_jobs = len(df)

    # rule for splitting sentences
    SENT_SPLIT = re.compile(r'(?<=[.!?;:\n])\s*')

    # matching rules:
    # 1) salary + $
    # 2) experience + number
    pattern_salary = re.compile(r'(?=.*\bsalary\b)(?=.*\$)', re.IGNORECASE)
    pattern_experience = re.compile(r'(?=.*\bexperience\b)(?=.*\d)', re.IGNORECASE)

    match_count = 0
    matched_sentences = []

    for _, row in df.iterrows():
        des = str(row['job_des'])
        # split original long description into sentences
        sentences = [s.strip() for s in SENT_SPLIT.split(des) if s.strip()]

        # however, some sentences are still too long (over 100 words), we need to further split them by commas
        refined_sentences = []
        for s in sentences:
            if len(s.split()) > 100:
                refined_sentences.extend([x.strip() for x in re.split(r'(?<=,)\s*', s) if x.strip()])
            else:
                refined_sentences.append(s)
        sentences = refined_sentences

        # check if any sentences match the patterns
        if any(pattern_salary.search(s) or pattern_experience.search(s) for s in sentences):
            match_count += 1
            matched_sentences.extend([
                s for s in sentences
                if pattern_salary.search(s) or pattern_experience.search(s)
            ])

    print(f"\n📊 Level: {level}")
    print(f"Total jobs: {total_jobs}")
    print(f"Jobs mentioning salary+$ or experience+number: {match_count}")
    print(f"Ratio: {match_count / total_jobs * 100:.2f}%")

    if match_count > 0:
        print("\nExamples:")
        for s in matched_sentences[:10]:
            print(" -", s)

count_jobs(level='Other')