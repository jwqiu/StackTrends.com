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

# ---------------------------
# 1️⃣ 读取数据库数据
# ---------------------------
conn = get_conn()
verify_cur = conn.cursor()
verify_cur.execute("""
    SELECT job_id, job_title, job_des, job_level
    FROM jobs_filtered
    WHERE job_level IS NOT NULL;
""")
rows = verify_cur.fetchall()
# 安全检查
if verify_cur.description is None:
    raise RuntimeError("⚠️ SQL 执行失败或没有返回结果，请检查字段名是否正确。")
colnames = [desc[0] for desc in verify_cur.description]
verify_cur.close()
conn.close()

df = pd.DataFrame(rows, columns=colnames)
print(f"总样本数: {len(df)}")
print(df['job_level'].value_counts())

# ---------------------------
# 2️⃣ 按类别分层划分数据集
# ---------------------------
# 先划分 train (0.6) vs temp (0.4)
train_df, temp_df = train_test_split(
    df,
    test_size=0.4,
    stratify=df['job_level'],
    random_state=42
)

# 再划分 temp -> val/test 各 0.2
val_df, test_df = train_test_split(
    temp_df,
    test_size=0.5,
    stratify=temp_df['job_level'],
    random_state=42
)

# ---------------------------
# 3️⃣ 检查每个子集的分布
# ---------------------------
def show_distribution(label, data):
    print(f"\n📊 {label} 集类别分布:")
    print(data['job_level'].value_counts())

show_distribution("Train", train_df)
show_distribution("Validation", val_df)
show_distribution("Test", test_df)

# ---------------------------
# 4️⃣ 可选：保存或传递变量
# ---------------------------
# train_df, val_df, test_df 可直接用于模型训练
# 例如：
# train_df.to_csv("train_data.csv", index=False)
# val_df.to_csv("val_data.csv", index=False)
# test_df.to_csv("test_data.csv", index=False)

# ---------------------------
# 1️⃣ 数据准备
# ---------------------------
# 假设你已有 train_df, val_df, test_df
# 每个有列: ['job_title', 'job_des', 'job_level']
# 如果文本是 job_title + job_des 拼一起更好

# pattern to split sentences
SENT_SPLIT = re.compile(r'(?<=[.!?:;·•|])\s+|\n+')

# pattern to detect sentences that contain the word "experience" along with a number

# 先尝试匹配条件 1（数字 + experience）
pattern_experience_num = re.compile(
    r'^(?!.*\$).*?(?:'
    r'\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|several)\b[^.]{0,50}\bexperience\b'
    r'|\bexperience\b[^.]{0,50}\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|several)\b'
    r')',
    re.IGNORECASE
)

# 再准备条件 2（岗位级别类）
pattern_level = re.compile(
    r'\bintern(ship)?\b'
    r'|\bgraduate|graduat(e|es|ed|ing)\b'
    r'|\bjunior\b'
    r'|\bexperienced\b',
    re.IGNORECASE
)

# Pattern to detect sentences that contain the word "experience"
# pattern_experience     = re.compile(r'\bexperience\b', re.IGNORECASE) 
pattern_experience = re.compile(
    r'\b('
    r'experience|experienced|'
    r'skill|skills'
    r')\b',
    re.IGNORECASE
)

# Pattern to detect sentences that contain the word "salary" along with a dollar sign
pattern_salary = re.compile(
    r'(?=.*\b(?:salary|compensation|pay)\b)(?=.*\$)',
    re.IGNORECASE
) 

def extract_requirement_text(
    text: str,
    use_experience: bool = False,
    use_experience_num: bool = True,
    use_salary: bool = False,
) -> str:

    # split job_des into sentences
    sentences = []
    for s in SENT_SPLIT.split(text):
        s = s.strip()
        if s:
            sentences.append(s)

    # split long sentences by commas
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
            if pattern_experience_num.search(s):        # ✅ 优先匹配条件 1（数字 + experience）
                exp_num_sents.append(s)
                continue
            elif pattern_level.search(s):               # ✅ 如果条件 1 没命中，再尝试条件 2（intern/junior/graduate/experienced）
                exp_num_sents.append(s)
                continue
        # check for salary information
        if use_salary and pattern_salary.search(s):
            salary_sents.append(s)
            continue
        # check for experience without numbers
        if use_experience and pattern_experience.search(s):
            exp_sents.append(s)

    # if none found, relax the condition to just contain "experience"
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

    return matched

train_df['job_des_filtered'] = train_df['job_des'].fillna('').apply(extract_requirement_text).tolist()
val_df['job_des_filtered'] = val_df['job_des'].fillna('').apply(extract_requirement_text).tolist()
test_df['job_des_filtered'] = test_df['job_des'].fillna('').apply(extract_requirement_text).tolist()

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

train_texts = train_df["title_plus_des"].tolist()
val_texts = val_df["title_plus_des"].tolist()
test_texts = test_df["title_plus_des"].tolist()

# ---------------------------
# 2️⃣ 文本向量化 (Embedding)
# ---------------------------
print("🔹 Encoding texts with SentenceTransformer ...")
model_emb = SentenceTransformer('intfloat/e5-large-v2',device="cpu")

train_emb = torch.from_numpy(model_emb.encode(train_texts, batch_size=32, show_progress_bar=True))
val_emb = torch.from_numpy(model_emb.encode(val_texts, batch_size=32, show_progress_bar=True))
test_emb = torch.from_numpy(model_emb.encode(test_texts, batch_size=32, show_progress_bar=True))

# ---------------------------
# 3️⃣ save embeddings and labels
# ---------------------------
os.makedirs("model_pipeline/embeddings", exist_ok=True)
torch.save({
    "train_emb": train_emb,
    "val_emb": val_emb,
    "test_emb": test_emb,
    "train_labels": train_df["job_level"].tolist(),
    "val_labels": val_df["job_level"].tolist(),
    "test_labels": test_df["job_level"].tolist(),
}, "model_pipeline/embeddings/embeddings.pt")

print("✅ Embeddings saved to model_pipeline/embeddings/embeddings.pt")