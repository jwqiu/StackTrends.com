import os, sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) # 把项目根目录加入模块搜索路径
from connect import get_conn
import torch
from model_pipeline.generate_embeddings import extract_requirement_text
from sentence_transformers import SentenceTransformer
import pandas as pd

print("🚀 Running generate_job_embeddings.py")
print("📂 Current file path:", __file__)
print("📁 Current working dir:", os.getcwd())

model_emb = SentenceTransformer("intfloat/e5-large-v2")
os.makedirs("python_scraper/embeddings", exist_ok=True)

conn = get_conn()
cursor = conn.cursor()
cursor.execute("SELECT job_id, job_title, job_des, job_level FROM jobs WHERE job_level = 'Other'")
rows = cursor.fetchall()
colnames = []
if cursor.description is not None:
    for desc in cursor.description:
        colnames.append(desc[0])

df = pd.DataFrame(rows, columns=colnames)
print(f"Loaded {len(df)} 'Other' level job postings.")

configs = [
    {"name": "1️⃣: only_exp_num", "use_experience_num": True, "use_salary": False, "use_experience": False},
    {"name": "2️⃣: exp_num+exp", "use_experience_num": True, "use_salary": False, "use_experience": True},
    # {"name": "3️⃣: exp_num+salary", "use_experience_num": True, "use_salary": True, "use_experience": False},
    # {"name": "4️⃣: all_enabled", "use_experience_num": True, "use_salary": True, "use_experience": True},
    # {"name": "5️⃣: all_disabled", "use_experience_num": False, "use_salary": False, "use_experience": False},
]

for cfg in configs:
    print(f"Processing configuration: {cfg['name']}")

    df['job_des_filtered'] = df['job_des'].fillna('').apply(
        lambda x: extract_requirement_text(
            x,
            use_experience=cfg["use_experience"],
            use_experience_num=cfg["use_experience_num"],
            use_salary=cfg["use_salary"]
        )
    ).tolist()

    df["title_plus_des"] = (
        "This job title is " + df["job_title"].astype(str) + ". " +
        df["job_des_filtered"].astype(str)
    )

    text = df["title_plus_des"].tolist()
    embeddings = torch.from_numpy(model_emb.encode(text, batch_size=32, show_progress_bar=True))

    torch.save(
        {
            "embeddings": embeddings,
            "raw_texts": text,   # ✅ 保存原始用于 embedding 的文本
            "job_id": df["job_id"].tolist(),
            "job_title": df["job_title"].tolist(),
            "job_des": df["job_des"].tolist()
        },
        f"python_scraper/embeddings/{cfg['name']}_embeddings.pt"
    )

    print(f"Saved embeddings to python_scraper/embeddings/{cfg['name']}_embeddings.pt")

