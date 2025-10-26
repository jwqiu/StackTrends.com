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
# ⚙️ 实验全局配置参数
# ---------------------------

# 每批训练样本的数量。
# - 数值越大：训练更快、梯度更稳定，但占用显存更高；
# - 数值越小：梯度更新更频繁，可能更稳定但训练慢。
batch_size = 32

# Embedding 文件路径列表。
# 每个文件对应一种文本特征抽取策略（不同 prompt 或 embedding 模型），
# 程序会依次加载这些文件并进行独立训练评估，用于对比结果。
embedding_paths = [
    "model_pipeline/embeddings/1️⃣: only_exp_num_embeddings.pt",             # 仅包含“数字+经验”信息的句向量
    "model_pipeline/embeddings/2️⃣: exp_num_and_experience_embeddings.pt",   # 数字+经验词复合特征
    "model_pipeline/embeddings/3️⃣: all_criteria_embeddings.pt",             # 启用全部筛选标准（完整特征）
    "model_pipeline/embeddings/4️⃣: all_disabled_embeddings.pt",             # 关闭全部筛选标准（控制组）
    "model_pipeline/embeddings/5️⃣: only_experience_embeddings.pt",          # 仅保留经验相关句子（去除数值）
]

# ---------------------------
# 🧠 MLP 网络结构配置
# ---------------------------

# 每层隐藏层的神经元数量。
# - 数量越多，模型容量越大（能学习更复杂的特征）；
# - 但过大容易过拟合。
hidden_dims = [256, 128]

# 每层对应的 dropout 比例，用于防止过拟合。
# - dropout=0.3 表示随机丢弃 30% 的神经元；
# - 通常前层大、后层小。
dropout_rates = [0.3, 0.2]

# 是否在计算损失时启用类别平衡权重。
# - True：自动计算每类样本数量，提升少数类（如 Junior）的学习权重；
# - False：所有类别权重相同。
balanced_class_weights = True

# ---------------------------
# 🧮 优化器配置
# ---------------------------

# 选择优化算法：
# - "Adam"：默认推荐，收敛快且稳定；
# - "AdamW"：带权重衰减的 Adam，泛化更好；
# - "SGD"：传统随机梯度下降，训练更慢但结果更平滑。
optimizer_name = "Adam"

# 学习率（Learning Rate）
# - 控制参数更新幅度；
# - 1e-3 是较常见的默认值；
# - 可尝试 5e-4 或 3e-3 做敏感度实验。
learning_rate = 1e-3

# 权重衰减（L2 正则项）
# - 防止过拟合；
# - 通常与 AdamW 一起使用；
# - 可设为 1e-4 观察正则化效果。
weight_decay = 0

# ---------------------------
# ⏱️ 训练控制参数
# ---------------------------

# 最大训练轮数。
# - 设置较大值（如 50），因为早停机制会自动终止训练；
# - 实际不会跑满所有轮数。
epochs = 50

# 早停机制的“耐心值”。
# - 当验证集 loss 连续 patience 轮不再下降时停止训练；
# - 通常取 5~10。
patience = 10

# 初始化最优验证集 loss。
# - 用无穷大（inf）保证第一次比较时任何结果都能被视为“更优”。
best_val_loss = float('inf')

# 早停计数器。
# - 统计验证集连续多少轮未改善；
# - 达到 patience 值后触发早停。
patience_counter = 0


for path in embedding_paths:
    data = torch.load(path)

    # ---------------------------
    # load embeddings and labels
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
    # 构建 DataLoader
    # ---------------------------
    train_loader = DataLoader(TensorDataset(train_emb, train_labels), batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(TensorDataset(val_emb, val_labels), batch_size=batch_size)
    test_loader = DataLoader(TensorDataset(test_emb, test_labels), batch_size=batch_size)

    # ---------------------------
    # 定义简单 MLP 模型
    # ---------------------------

    class MLPClassifier(nn.Module):
        def __init__(self, input_dim, num_classes, hidden_dims=[256, 128], dropout_rates=[0.3, 0.2]):
            """
            input_dim: 输入 embedding 的维度（例如 e5-large-v2 输出是 1024）
            num_classes: 分类数（比如 3）
            hidden_dims: 每层隐藏层神经元数量列表，例如 [512,256,128]
            dropout_rates: 每层对应的 dropout 比例，例如 [0.4,0.3,0.2]
            """
            super().__init__()

            # 动态构建多层 MLP 结构
            layers = []
            prev_dim = input_dim

            for h_dim, d_rate in zip(hidden_dims, dropout_rates):
                layers.append(nn.Linear(prev_dim, h_dim))
                layers.append(nn.ReLU())
                layers.append(nn.Dropout(d_rate))
                prev_dim = h_dim

            # 输出层
            layers.append(nn.Linear(prev_dim, num_classes))

            # 封装成顺序网络
            self.net = nn.Sequential(*layers)

        def forward(self, x):
            return self.net(x)


    # -------------------------
    # 定义模型结构
    # -------------------------
    input_dim = train_emb.shape[1]

    # baseline 版本（两层）
    model = MLPClassifier(
        input_dim=input_dim,
        num_classes=len(le.classes_),
        hidden_dims=hidden_dims,
        dropout_rates=dropout_rates
    )

    # 或者：更深一点版本（适合 e5-large-v2）
    # model = MLPClassifier(
    #     input_dim=input_dim,
    #     num_classes=len(le.classes_),
    #     hidden_dims=[512, 256, 128],
    #     dropout_rates=[0.4, 0.3, 0.2]
    # )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)

    # ---------------------------
    # 定义损失函数
    # ---------------------------

    if balanced_class_weights:
        # 计算每个类别的权重
        class_weights = compute_class_weight(
            class_weight='balanced',
            classes=np.unique(train_labels.numpy()),
            y=train_labels.numpy()
        )
        class_weights = torch.tensor(class_weights, dtype=torch.float).to(device)
    else:
        class_weights = None

    # 使用加权损失函数
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    # ---------------------------
    # 创建优化器
    # ---------------------------
    if optimizer_name == "Adam":
        optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate, weight_decay=weight_decay)
    elif optimizer_name == "AdamW":
        optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=weight_decay)
    elif optimizer_name == "SGD":
        optimizer = torch.optim.SGD(model.parameters(), lr=learning_rate, momentum=0.9, weight_decay=weight_decay)
    else:
        raise ValueError(f"Unsupported optimizer: {optimizer_name}")

    # ---------------------------
    # 训练循环
    # ---------------------------
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
            # save_dir = "model_pipeline"
            # save_path = os.path.join(save_dir, "best_model.pt")
            # torch.save(model.state_dict(), save_path)  # 保存当前最优模型
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