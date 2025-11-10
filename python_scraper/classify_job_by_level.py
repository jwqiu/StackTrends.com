import os, sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) # 把项目根目录加入模块搜索路径
import torch
from model_pipeline.train_classifier import MLPClassifier
import pandas as pd
from python_scraper.connect import get_conn


embedding_paths = {
    "only_exp_num": "python_scraper/embeddings/1️⃣: only_exp_num_embeddings.pt",
    # "exp_num+exp": "python_scraper/embeddings/2️⃣: exp_num+exp_embeddings.pt",

}

for name, path in embedding_paths.items():

    # ---------------------------
    # 1️⃣ 加载 embedding 文件
    # ---------------------------
    data = torch.load(path)
    X_embeddings = data['embeddings']
    input_dim = X_embeddings.shape[1]
    job_ids = data["job_id"]
    job_titles = data["job_title"]
    raw_texts = data["raw_texts"]

    # ---------------------------
    # 2️⃣ 创建模型实例
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
    # 3️⃣ 加载训练好的权重
    # ---------------------------
    model.load_state_dict(torch.load("model_pipeline/best_model.pt", map_location=torch.device('cpu')))
    model.eval()
    print(f"✅ Loaded model for embeddings from {path} successfully.")

    # ---------------------------
    # 4️⃣ 模型预测
    # ---------------------------

    with torch.no_grad():
        logits = model(X_embeddings)
        probs = torch.softmax(logits, dim=1)
        preds = torch.argmax(probs, dim=1).cpu().numpy()

    # ---------------------------
    # 5️⃣ 映射类别名称
    # ---------------------------
    label_map = {0: "Intermediate", 1: "Junior", 2: "Senior"}  # 要与训练时一致
    pred_labels = [label_map[i] for i in preds]

    # ---------------------------
    # 6️⃣ 保存结果到 CSV
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
            print(f"⚠️ 更新 job_id={job_id} 时出错: {e}")
            conn.rollback()
    
    conn.commit()
    cursor.close()
    conn.close()
    print("✅ All updates committed successfully.")