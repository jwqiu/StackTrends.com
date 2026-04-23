import pandas as pd
import re
from collections import Counter
import psycopg2
from .connect import get_conn

def load_job_data():
    conn = get_conn()
    cursor = conn.cursor()
    # cursor.execute("SELECT job_id, job_des, year_of_experience FROM jobs WHERE year_of_experience IS NULL")
    cursor.execute("SELECT job_id, job_des, year_of_experience FROM jobs WHERE job_level IS NULL or job_level =''")

    rows = cursor.fetchall()
    colnames = [desc[0] for desc in cursor.description]  # 获取列名 # type: ignore
    cursor.close()
    conn.close()
    # return a pandas dataframe
    return pd.DataFrame(rows, columns=colnames) 


def extract_single_yoe_from_text(text, window_size=10):
    """
    Return the YOE number only when:
    - a job_des may contain multiple 'year' / 'years'
    - among all these 'year' keywords, exactly one of them has a number 1-10
      within +/- window_size characters
    - and that matched year keyword has only one valid number in its window
    
    Otherwise, if the job_des contains no year keyword, but contains a month keyword (e.g. "3 months"), return "<1 yrs".

    Otherwise, return None.
    """
    if not text:
        return None

    text = text.lower()
    matched_year_keywords = []

    # mapping word numbers to digits
    word_to_num = {
        "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
        "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10", "eleven": "11"
    }
    
     # ========= 1️⃣ YEAR logic =========
    for match in re.finditer(r'\byears?\b', text):
        start, end = match.span()

        left_part = text[max(0, start - window_size):start]
        right_part = text[end:min(len(text), end + window_size)]
        window_text = left_part + " " + right_part

        # replace word numbers with digits in the window
        for word, num in word_to_num.items():
            window_text = re.sub(rf'\b{word}\b', num, window_text)

        nums = re.findall(r'\b(10|[1-9])\b', window_text)

        # if there is exactly one valid number in the window, extract it as a candidate YOE
        if len(nums) == 1:
            matched_year_keywords.append(int(nums[0]))

    # if there is exactly one matched year keyword with a valid number in the whole job_des, return that number as YOE
    # i understand this is not a perfect logic, but it is a simple and easy to implement method to extract YOE in many cases, and it can be further improved in the future if needed
    if len(matched_year_keywords) == 1:
        return matched_year_keywords[0]

     # ========= 2️⃣ MONTH fallback =========
    month_match = re.search(r'\b(1[01]|[1-9])\s*months?\b', text)

    if month_match:
        return "0"   

    return None


def update_year_of_experience():
    df = load_job_data()

    total_jobs = len(df) 
    print(f"Total jobs loaded: {total_jobs}")
           
    identified_count = 0 

    conn = get_conn()
    cursor = conn.cursor()

    # for each job_des, extract YOE using the above function, and update the year of experience in the database if a YOE is identified
    for _, row in df.iterrows():
        job_id = row["job_id"]
        job_des = row["job_des"]

        yoe = extract_single_yoe_from_text(job_des, window_size=10)

        if yoe is not None:
            identified_count += 1 
            cursor.execute(
                """
                UPDATE jobs
                SET year_of_experience = %s
                WHERE job_id = %s
                """,
                (yoe, job_id)
            )

    conn.commit()
    cursor.close()
    conn.close()

    print(f"YOE identified: {identified_count}")


