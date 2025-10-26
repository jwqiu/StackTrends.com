import sys, os
import pandas as pd
from sklearn.model_selection import train_test_split

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
from sklearn.utils.class_weight import compute_class_weight
import numpy as np
import random

# 固定随机种子，保证结果可复现
SEED = 42
torch.manual_seed(SEED)
torch.cuda.manual_seed_all(SEED)
np.random.seed(SEED)
random.seed(SEED)

# 确保每次计算一致（但略微影响性能）
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark = False

# ---------------------------
# 1️⃣ 读取数据库数据
# ---------------------------
# conn = get_conn()
# verify_cur = conn.cursor()
# verify_cur.execute("""
#     SELECT job_id, job_title, job_des, job_level
#     FROM jobs_filtered
#     WHERE job_level IS NOT NULL;
# """)
# rows = verify_cur.fetchall()
# # 安全检查
# if verify_cur.description is None:
#     raise RuntimeError("⚠️ SQL 执行失败或没有返回结果，请检查字段名是否正确。")
# colnames = [desc[0] for desc in verify_cur.description]
# verify_cur.close()
# conn.close()

# df = pd.DataFrame(rows, columns=colnames)
# print(f"总样本数: {len(df)}")
# print(df['job_level'].value_counts())

# ---------------------------
# 2️⃣ 按类别分层划分数据集
# ---------------------------
# 先划分 train (0.6) vs temp (0.4)
# train_df, temp_df = train_test_split(
#     df,
#     test_size=0.4,
#     stratify=df['job_level'],
#     random_state=42
# )

# # 再划分 temp -> val/test 各 0.2
# val_df, test_df = train_test_split(
#     temp_df,
#     test_size=0.5,
#     stratify=temp_df['job_level'],
#     random_state=42
# )

# ---------------------------
# 3️⃣ 检查每个子集的分布
# ---------------------------
# def show_distribution(label, data):
#     print(f"\n📊 {label} 集类别分布:")
#     print(data['job_level'].value_counts())

# show_distribution("Train", train_df)
# show_distribution("Validation", val_df)
# show_distribution("Test", test_df)

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
# def combine_text(df):
#     return (df['job_title'].fillna('') + ' ' + df['job_des'].fillna('')).tolist()

# train_texts = combine_text(train_df)
# val_texts = combine_text(val_df)
# test_texts = combine_text(test_df)

data = torch.load("model_pipeline/embeddings/embeddings.pt")

# ---------------------------
# 2️⃣ 文本向量化 (Embedding)
# ---------------------------

# 标签编码
le = LabelEncoder()
train_labels = torch.tensor(le.fit_transform(data["train_labels"]), dtype=torch.long)
val_labels   = torch.tensor(le.transform(data["val_labels"]), dtype=torch.long)
test_labels  = torch.tensor(le.transform(data["test_labels"]), dtype=torch.long)

train_emb = data["train_emb"]
val_emb   = data["val_emb"]
test_emb  = data["test_emb"]

# ---------------------------
# 3️⃣ 构建 DataLoader
# ---------------------------
batch_size = 32
train_loader = DataLoader(TensorDataset(train_emb, train_labels), batch_size=batch_size, shuffle=True)
val_loader = DataLoader(TensorDataset(val_emb, val_labels), batch_size=batch_size)
test_loader = DataLoader(TensorDataset(test_emb, test_labels), batch_size=batch_size)

# ---------------------------
# 4️⃣ 定义简单 MLP 模型
# ---------------------------
class MLPClassifier(nn.Module):
    def __init__(self, input_dim, hidden_dim, num_classes):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, num_classes)
        )

    def forward(self, x):
        return self.net(x)

input_dim = train_emb.shape[1]
model = MLPClassifier(input_dim=input_dim, hidden_dim=128, num_classes=len(le.classes_))
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)

# ---------------------------
# 5️⃣ 训练
# ---------------------------
# criterion = nn.CrossEntropyLoss()

# 计算每个类别的权重
class_weights = compute_class_weight(
    class_weight='balanced',
    classes=np.unique(train_labels.numpy()),
    y=train_labels.numpy()
)
class_weights = torch.tensor(class_weights, dtype=torch.float).to(device)

# 使用加权损失函数
criterion = nn.CrossEntropyLoss(weight=class_weights)

optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
epochs = 50            # 最大训练轮数
patience = 10           # 连续多少轮验证集不提升就停止
best_val_loss = float('inf')
patience_counter = 0

for epoch in range(epochs):
    # ====== 训练阶段 ======
    model.train()
    total_loss = 0
    for X_batch, y_batch in train_loader:
        X_batch, y_batch = X_batch.to(device), y_batch.to(device)
        optimizer.zero_grad()
        outputs = model(X_batch)
        loss = criterion(outputs, y_batch)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()

    avg_train_loss = total_loss / len(train_loader)

    # ====== 验证阶段 ======
    model.eval()
    val_loss = 0
    with torch.no_grad():
        for X_val, y_val in val_loader:
            X_val, y_val = X_val.to(device), y_val.to(device)
            outputs = model(X_val)
            loss = criterion(outputs, y_val)
            val_loss += loss.item()

    avg_val_loss = val_loss / len(val_loader)

    print(f"Epoch {epoch+1}/{epochs} - Train Loss: {avg_train_loss:.4f} - Val Loss: {avg_val_loss:.4f}")

    # ====== 早停逻辑 ======
    if avg_val_loss < best_val_loss:
        best_val_loss = avg_val_loss
        patience_counter = 0
        save_dir = "model_pipeline"
        save_path = os.path.join(save_dir, "best_model.pt")
        torch.save(model.state_dict(), save_path)  # 保存当前最优模型
    else:
        patience_counter += 1
        print(f"⚠️ No improvement for {patience_counter} epoch(s)")
        if patience_counter >= patience:
            print("⏹️ Early stopping triggered!")
            break
# ---------------------------
# 6️⃣ 评估
# ---------------------------
def evaluate(model, loader, y_true):
    model.eval()
    preds = []
    with torch.no_grad():
        for X_batch, _ in loader:
            X_batch = X_batch.to(device)
            outputs = model(X_batch)
            preds.extend(outputs.argmax(dim=1).cpu().numpy())
    return preds

val_preds = evaluate(model, val_loader, val_labels)
test_preds = evaluate(model, test_loader, test_labels)

print("\n📊 Validation Results:")
print(classification_report(val_labels.cpu().numpy(), val_preds, target_names=le.classes_))

print("\n📊 Test Results:")
print(classification_report(test_labels.cpu().numpy(), test_preds, target_names=le.classes_))