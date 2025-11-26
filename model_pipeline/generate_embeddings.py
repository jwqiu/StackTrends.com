import sys, os
import pandas as pd
from sklearn.model_selection import train_test_split
import re

# 添加项目路径
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from python_scraper.connect import get_conn
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report
from sentence_transformers import SentenceTransformer
from tqdm import tqdm


# ------------------------------------------------------
# function and configuration for sentence extraction
# ------------------------------------------------------
# 假设你已有 train_df, val_df, test_df
# 每个有列: ['job_title', 'job_des', 'job_level']
# 如果文本是 job_title + job_des 拼一起更好

# pattern to split sentences
SENT_SPLIT = re.compile(r'(?<=[.!?:;·•|])\s+|\n+')

# pattern to detect sentences that contain specific keywords
# experience with numbers
pattern_experience_num = re.compile(
    r'^(?!.*\$).*?(?:'
    r'\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|several)\b[^.]{0,50}\bexperience\b'
    r'|\bexperience\b[^.]{0,50}\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|several)\b'
    r')',
    re.IGNORECASE
)

# keywords that indicate job level
pattern_level = re.compile(
    r'\bintern(ship)?\b'
    r'|\bgraduate|graduat(e|es|ed|ing)\b'
    r'|\bjunior\b'
    r'|\bexperienced\b',
    re.IGNORECASE
)

# keywords that indicate the skill/experience requirement
pattern_experience = re.compile(
    r'\b('
    r'experience|experienced|'
    r'skill|skills'
    r')\b',
    re.IGNORECASE
)

# keywords that indicate salary information
pattern_salary = re.compile(
    r'(?=.*\b(?:salary|compensation|pay)\b)(?=.*\$)',
    re.IGNORECASE
) 

# this function takes a job description as input and extracts relevant sentences based on the selected patterns
def extract_requirement_text(
    text: str,
    use_experience: bool = True,
    use_experience_num: bool = True,
    use_salary: bool = True,
) -> str:

    # split job_des into sentences
    sentences = []
    for s in SENT_SPLIT.split(text):
        s = s.strip()
        if s:
            sentences.append(s)

    # further split long sentences by commas
    refined_sentences = []
    for s in sentences:
        if len(s.split()) > 100:
            parts = re.split(r'(?<=,)\s*', s)
            clean_parts =[]
            for x in parts:
                x = x.strip()
                if x:
                    clean_parts.append(x)
            refined_sentences.extend(clean_parts)
        else:
            refined_sentences.append(s)

    sentences = refined_sentences

    # define three lists to store different types of matched sentences
    exp_num_sents, salary_sents, exp_sents = [], [], []

    # find sentences that match the patterns
    for s in sentences:
        # skip questions, like what experience do you have ?
        if s.strip().endswith('?'):
            continue
        # check for experience with numbers
        if use_experience_num:
            if pattern_experience_num.search(s): # check condition 1 first
                exp_num_sents.append(s) # if find sentences match this pattern, add to list
                continue
            elif pattern_level.search(s): # check condition 2 if condition 1 not met
                exp_num_sents.append(s) 
                continue
        # check for salary information
        if use_salary and pattern_salary.search(s):
            salary_sents.append(s)
            continue
        # check for experience without numbers
        if use_experience and pattern_experience.search(s):
            exp_sents.append(s)

    # just in case if use experience is not enabled and nothing matches the selected patterns, then loosen the criteria and match by experience pattern only
    if not (exp_num_sents or salary_sents or exp_sents):
        exp_sents = [s for s in sentences if pattern_experience.search(s) and not s.strip().endswith('?')]

    exp_num_text = ""
    salary_text = ""
    exp_text = ""

    # add labels to the extracted parts
    if exp_num_sents:
        exp_num_text = "[Years of experience required] " + " ".join(exp_num_sents)
    if salary_sents:
        salary_text = "[Salary details] " + " ".join(salary_sents)
    if exp_sents:
        exp_text = "[Experience and Skills] " + " ".join(exp_sents)

    # combine the extracted parts
    parts = [exp_num_text, salary_text, exp_text]
    matched = " ".join(p for p in parts if p).strip()

    if not matched:
        matched = "[Job Description:] " + text

    return matched

# ------------------------------------------------------
# main execution code
# ------------------------------------------------------

# if this script is run directly, execute the following code
# if this script is imported as a module, the following code will not run
if __name__ == "__main__":

    # ------------------------------------------------------
    # 1️⃣ load data from database
    # ------------------------------------------------------
    conn = get_conn()
    verify_cur = conn.cursor()
    verify_cur.execute("""
        SELECT job_id, job_title, job_des, job_level
        FROM jobs_filtered
        WHERE job_level IS NOT NULL;
    """)
    rows = verify_cur.fetchall()
    # safety check
    if verify_cur.description is None:
        raise RuntimeError("⚠️ no data fetched from database")
    # get column names
    colnames = [desc[0] for desc in verify_cur.description]
    verify_cur.close()
    conn.close()
    
    # create a new dataframe
    df = pd.DataFrame(rows, columns=colnames)
    print(f"Total samples: {len(df)}")
    print(df['job_level'].value_counts())

    # ------------------------------------------------------
    # 2️⃣ split the data but keep the job levels balanced
    # ------------------------------------------------------
    # First split train (0.6) vs temp (0.4)
    train_df, temp_df = train_test_split(
        df,
        test_size=0.4,
        stratify=df['job_level'],
        random_state=42
    )

    # Then split temp -> val/test each 0.2
    val_df, test_df = train_test_split(
        temp_df,
        test_size=0.5,
        stratify=temp_df['job_level'],
        random_state=42
    )

    # ------------------------------------------------------
    # 3️⃣ Check the distribution of each subset
    # ------------------------------------------------------
    def show_distribution(label, data):
        print(f"\n📊 {label} subset category distribution:")
        print(data['job_level'].value_counts())

    show_distribution("Train", train_df)
    show_distribution("Validation", val_df)
    show_distribution("Test", test_df)

    # ------------------------------------------------------
    # 4️⃣ Optional: Save or pass variables
    # ------------------------------------------------------
    # train_df, val_df, test_df can be directly used for model training
    # For example:
    # train_df.to_csv("train_data.csv", index=False)
    # val_df.to_csv("val_data.csv", index=False)
    # test_df.to_csv("test_data.csv", index=False)

    # ------------------------------------------------------
    # 5️⃣ configure different extraction settings and generate embeddings
    # ------------------------------------------------------
    configs = [
        {"name": "1️⃣: only_exp_num", "use_experience_num": True, "use_salary": False, "use_experience": False},
        {"name": "2️⃣: exp_num+exp", "use_experience_num": True, "use_salary": False, "use_experience": True},
        {"name": "3️⃣: exp_num+salary", "use_experience_num": True, "use_salary": True, "use_experience": False},
        # {"name": "4️⃣: all_enabled", "use_experience_num": True, "use_salary": True, "use_experience": True},
        # {"name": "5️⃣: all_disabled", "use_experience_num": False, "use_salary": False, "use_experience": False},
    ]

    for cfg in configs:
        
        # ------------------------------------------------------
        # 1️⃣ prepare and filter texts for embedding
        # ------------------------------------------------------

        print(f"\n=== Config: {cfg['name']} ===")

        # this extractor function will be applied to each job description in each subset
        # After extraction, we'll have a new column job_des_filtered that contains only the sentences with relevant information
        train_df['job_des_filtered'] = train_df['job_des'].fillna('').apply(
            lambda x: extract_requirement_text(
                x,
                use_experience=cfg["use_experience"],
                use_experience_num=cfg["use_experience_num"],
                use_salary=cfg["use_salary"]
            )
        ).tolist()
        val_df['job_des_filtered'] = val_df['job_des'].fillna('').apply(
            lambda x: extract_requirement_text(
                x,
                use_experience=cfg["use_experience"],
                use_experience_num=cfg["use_experience_num"],
                use_salary=cfg["use_salary"]
            )
        ).tolist()
        test_df['job_des_filtered'] = test_df['job_des'].fillna('').apply(
            lambda x: extract_requirement_text(
                x,
                use_experience=cfg["use_experience"],
                use_experience_num=cfg["use_experience_num"],
                use_salary=cfg["use_salary"]
            )
        ).tolist()
        
        # then, combine job title and filtered job description for embedding
        train_df["title_plus_des"] = (
            "This job title is " + train_df["job_title"].astype(str) + ". " +
            train_df["job_des_filtered"].astype(str)
        )
        val_df["title_plus_des"] = (
            "This job title is " + val_df["job_title"].astype(str) + ". " +
            val_df["job_des_filtered"].astype(str)
        )
        test_df["title_plus_des"] = (
            "This job title is " + test_df["job_title"].astype(str) + ". " +
            test_df["job_des_filtered"].astype(str)
        )

        # filter four types of texts and later evaluate which ones contribute most to classification performance

        # test_titles = test_df["job_title"].astype(str).tolist()
        # test_exp_num_texts = test_df["job_des_filtered"].apply(
        #     lambda x: " ".join(re.findall(r'\[Years of experience required\].*?(?=\[|$)', x))
        # ).tolist()
        # test_salary_texts = test_df["job_des_filtered"].apply(
        #     lambda x: " ".join(re.findall(r'\[Salary details\].*?(?=\[|$)', x))
        # ).tolist()
        # test_exp_skill_texts = test_df["job_des_filtered"].apply(
        #     lambda x: " ".join(re.findall(r'\[Experience and Skills\].*?(?=\[|$)', x))
        # ).tolist()

        # this part of code prepare job title + raw job description for embedding

        # print("\n=== Generating embeddings for RAW JD + Job Title ===")
        # train_df["title_plus_des"] = (
        #     "This job title is " + train_df["job_title"].astype(str) + ". " +
        #     train_df["job_des"].astype(str)
        # )
        # val_df["title_plus_des"] = (
        #     "This job title is " + val_df["job_title"].astype(str) + ". " +
        #     val_df["job_des"].astype(str)
        # )
        # test_df["title_plus_des"] = (
        #     "This job title is " + test_df["job_title"].astype(str) + ". " +
        #     test_df["job_des"].astype(str)
        # )

        # most models expect a list of texts as input
        train_texts = train_df["title_plus_des"].tolist()
        val_texts = val_df["title_plus_des"].tolist()
        test_texts = test_df["title_plus_des"].tolist()

        # ------------------------------------------------------
        # 2️⃣ start generating embeddings
        # ------------------------------------------------------
        print("🔹 Encoding texts with SentenceTransformer ...")
        # this model performs best among 4 open source models i have tested so far
        model_emb = SentenceTransformer('intfloat/e5-large-v2',device="cpu")

        # Generate embeddings and convert them to PyTorch tensor format.
        train_emb = torch.from_numpy(model_emb.encode(train_texts, batch_size=32, show_progress_bar=True))
        val_emb = torch.from_numpy(model_emb.encode(val_texts, batch_size=32, show_progress_bar=True))
        test_emb = torch.from_numpy(model_emb.encode(test_texts, batch_size=32, show_progress_bar=True))

        # generate embeddings for four different text types for later analysis

        # test_title_emb = torch.from_numpy(model_emb.encode(test_titles, batch_size=32, show_progress_bar=True))
        # test_exp_num_emb = torch.from_numpy(model_emb.encode(test_exp_num_texts, batch_size=32, show_progress_bar=True))
        # test_salary_emb = torch.from_numpy(model_emb.encode(test_salary_texts, batch_size=32, show_progress_bar=True))
        # test_exp_skill_emb = torch.from_numpy(model_emb.encode(test_exp_skill_texts, batch_size=32, show_progress_bar=True))

        # ------------------------------------------------------
        # 3️⃣ save embeddings and labels
        # ------------------------------------------------------
        
        os.makedirs("model_pipeline/embeddings", exist_ok=True)

        # this code saves the embeddings generated from filtered job descriptions along with job level labels
        torch.save({
            "train_emb": train_emb,
            "val_emb": val_emb,
            "test_emb": test_emb,
            "train_labels": train_df["job_level"].tolist(),
            "val_labels": val_df["job_level"].tolist(),
            "test_labels": test_df["job_level"].tolist(),
            # "test_title_emb": test_title_emb,
            # "test_exp_num_emb": test_exp_num_emb,
            # "test_salary_emb": test_salary_emb,
            # "test_exp_skill_emb": test_exp_skill_emb,  # ✅ 新增
        }, f"model_pipeline/embeddings/{cfg['name']}_embeddings.pt")

        print(f"✅ Embeddings saved to model_pipeline/embeddings/{cfg['name']}_embeddings.pt")

        # this code saves the embeddings generated from raw job descriptions along with job level labels
        # torch.save({
        #     "train_emb": train_emb,
        #     "val_emb": val_emb,
        #     "test_emb": test_emb,
        #     "train_labels": train_df["job_level"].tolist(),
        #     "val_labels": val_df["job_level"].tolist(),
        #     "test_labels": test_df["job_level"].tolist(),
        # }, "model_pipeline/embeddings/raw_jd_embeddings.pt")

        # print("✅ Embeddings saved to model_pipeline/embeddings/raw_jd_embeddings.pt")