import os, sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) # 把项目根目录加入模块搜索路径
import torch
from model_pipeline.local_experiments.train_classifier import MLPClassifier
import pandas as pd
from python_scraper.connect import get_conn


# which embedding file to use for classification
embedding_paths = {
    "only_exp_num": "model_pipeline/production_script/embeddings/1️⃣: only_exp_num_embeddings.pt",
    # "exp_num+exp": "model_pipeline/production_script/embeddings/2️⃣: exp_num+exp_embeddings.pt",

}

for name, path in embedding_paths.items():

    # ---------------------------
    # 1️⃣ load embeddings and metadata
    # ---------------------------
    data = torch.load(path)
    X_embeddings = data['embeddings']
    input_dim = X_embeddings.shape[1]
    job_ids = data["job_id"]
    job_titles = data["job_title"]
    raw_texts = data["raw_texts"]

    # ---------------------------
    # 2️⃣ create model instance
    # the model has been defined in train_classifier.py
    # ---------------------------
    model = MLPClassifier(
        input_dim=input_dim,
        num_classes=3,
        hidden_dims=[1024, 512, 256, 128],
        dropout_rates=[0.4, 0.3, 0.2, 0.1],
        activation="relu",
        use_batchnorm=False,
        use_layernorm=False
    )

    # ---------------------------
    # 3️⃣ load trained weights
    # ---------------------------
    model.load_state_dict(torch.load("model_pipeline/local_experiments/best_model.pt", map_location=torch.device('cpu')))
    model.eval()
    print(f"✅ Loaded model for embeddings from {path} successfully.")

    # ---------------------------
    # 4️⃣ evaluate on the embeddings
    # ---------------------------

    with torch.no_grad():
        logits = model(X_embeddings)
        probs = torch.softmax(logits, dim=1)
        preds = torch.argmax(probs, dim=1).cpu().numpy()

    # ---------------------------
    # 5️⃣ map predicted indices to labels
    # ---------------------------
    # must be consistent with training
    # the LabelEncoder assigns class IDs alphabetically
    label_map = {0: "Intermediate", 1: "Junior", 2: "Senior"} 
    pred_labels = [label_map[i] for i in preds]

    # ---------------------------
    # 6️⃣ save results to CSV
    # ---------------------------
    df = pd.DataFrame({
        "job_id": job_ids,
        "job_title": job_titles,
        "raw_text": raw_texts,
        "pred_label": pred_labels,
        "pred_idx": preds
    })

    # save_path = f"python_scraper/predictions/{name}_predictions.csv"
    # os.makedirs(os.path.dirname(save_path), exist_ok=True)
    # df.to_csv(save_path, index=False, encoding="utf-8-sig")
    # print(f"💾 Saved predictions to {save_path}")

    print(df.head(30))

    conn = get_conn()
    cursor = conn.cursor()

    # update job level in the database
    for _, row in df.iterrows():
        job_id = row["job_id"]
        job_level = row["pred_label"]

        try:
            cursor.execute(
                """
                UPDATE jobs
                SET job_level = %s
                WHERE job_id = %s;
                """,
                (job_level, job_id),
            )
        except Exception as e:
            print(f"⚠️ Error updating job_id={job_id}: {e}")
            conn.rollback()
    
    conn.commit()
    cursor.close()
    conn.close()
    print("✅ All updates committed successfully.")