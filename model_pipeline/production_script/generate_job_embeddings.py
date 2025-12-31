import os, sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) # 把项目根目录加入模块搜索路径
from connect import get_conn
import torch
from model_pipeline.local_experiments.generate_embeddings import extract_requirement_text
from sentence_transformers import SentenceTransformer
import pandas as pd

# ------------------------------------------------------------------------------------------------------------------------------------------------------------------
# the pipeline for classifying job levels first uses a pre-trained and open-source LLM to generate embeddings for the text extracted from job postings
# the embeddings are simply vectors in a multi-dimensional space that represent the semantic meaning of the text
# ideally, embeddings generated from job postings of different levels should be separable in the multi-dimensional space, 
# while embeddings from the same level should be close to each other and share similar patterns
# then i trained an MLP classifier to classify those embeddigns into different job levels, since the embeddings are already seperable and meaningful in the multi-dimensional space
# note that the MLP classifier does not classify the raw job text directly, it classifies the embeddings generated from the raw text
# generating good embeddings is the key to the success of this pipeline
# generating embeddings first and then using a small model to do the actual task is the modern, standard approch in machine learning and NLP
# ------------------------------------------------------------------------------------------------------------------------------------------------------------------


print("🚀 Running generate_job_embeddings.py")
print("📂 Current file path:", __file__)
print("📁 Current working dir:", os.getcwd())

# only use the model with the best embedding separation score, the one we tested in visualize_embedding_separation.py in model_pipeline
# this is a pretrained transformer-based language model called E5-large-v2, accessed through the SentenceTransformers library
# this model designed for text embeddings rather than text generation
model_emb = SentenceTransformer("intfloat/e5-large-v2") 
os.makedirs("model_pipeline/production_script/embeddings", exist_ok=True)

conn = get_conn()
cursor = conn.cursor()
# only select jobs where job_level='Other', meaning they have not been classified yet
cursor.execute("SELECT job_id, job_title, job_des, job_level FROM jobs WHERE job_level = 'Other'")
rows = cursor.fetchall()
colnames = []
if cursor.description is not None:
    for desc in cursor.description:
        colnames.append(desc[0])

df = pd.DataFrame(rows, columns=colnames)
print(f"Loaded {len(df)} 'Other' level job postings.")

# configurations for different text extraction strategies
configs = [
    {"name": "1️⃣: only_exp_num", "use_experience_num": True, "use_salary": False, "use_experience": False},
    {"name": "2️⃣: exp_num+exp", "use_experience_num": True, "use_salary": False, "use_experience": True},
    # {"name": "3️⃣: exp_num+salary", "use_experience_num": True, "use_salary": True, "use_experience": False},
    # {"name": "4️⃣: all_enabled", "use_experience_num": True, "use_salary": True, "use_experience": True},
    # {"name": "5️⃣: all_disabled", "use_experience_num": False, "use_salary": False, "use_experience": False},
]

for cfg in configs:
    print(f"Processing configuration: {cfg['name']}")

    # apply text extraction function to each job description (row by row)
    df['job_des_filtered'] = df['job_des'].fillna('').apply(
        lambda x: extract_requirement_text(
            x,
            use_experience=cfg["use_experience"],
            use_experience_num=cfg["use_experience_num"],
            use_salary=cfg["use_salary"]
        )
    ).tolist()

    # combine job title and filtered job description for embedding
    df["title_plus_des"] = (
        "This job title is " + df["job_title"].astype(str) + ". " +
        df["job_des_filtered"].astype(str)
    )

    text = df["title_plus_des"].tolist()
    # generate embeddings for the combined text
    embeddings = torch.from_numpy(model_emb.encode(text, batch_size=32, show_progress_bar=True))

    # save embeddings and associated metadata to a .pt file for later use
    torch.save(
        {
            "embeddings": embeddings,
            "raw_texts": text,   # keep the raw texts for reference
            "job_id": df["job_id"].tolist(),
            "job_title": df["job_title"].tolist(),
            "job_des": df["job_des"].tolist()
        },
        f"model_pipeline/production_script/embeddings/{cfg['name']}_embeddings.pt"
    )

    print(f"Saved embeddings to model_pipeline/production_script/embeddings/{cfg['name']}_embeddings.pt")
