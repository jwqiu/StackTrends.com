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
from sklearn.metrics import accuracy_score, f1_score
import itertools
from typing import Dict, List, Union, cast
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay
import matplotlib.pyplot as plt
from imblearn.over_sampling import RandomOverSampler
import shap


# set random seeds for reproducibility
SEED = 42
torch.manual_seed(SEED)
torch.cuda.manual_seed_all(SEED)
np.random.seed(SEED)
random.seed(SEED)

# 确保每次计算一致（但略微影响性能）
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark = False

# ---------------------------
# experiment configurations
# ---------------------------

# 每批训练样本的数量。
# - 数值越大：训练更快、梯度更稳定，但占用显存更高；
# - 数值越小：梯度更新更频繁，可能更稳定但训练慢。
# batch_size = [16, 32, 64]
# batch_size = [32, 64]
batch_size = [64]

# Embedding 文件路径列表。
# 每个文件对应一种文本特征抽取策略（不同 prompt 或 embedding 模型），
# 程序会依次加载这些文件并进行独立训练评估，用于对比结果。
embedding_paths = [
    "model_pipeline/embeddings/1️⃣: only_exp_num_embeddings_new.pt",             # 仅包含“数字+经验”信息的句向量
    # "model_pipeline/embeddings/2️⃣: exp_num+exp_embeddings.pt",   # 数字+经验词复合特征
    # "model_pipeline/embeddings/3️⃣: exp_num+salary_embeddings.pt",             # 启用全部筛选标准（完整特征）
    # "model_pipeline/embeddings/4️⃣: all_enabled_embeddings.pt",             # 关闭全部筛选标准（控制组）
    # "model_pipeline/embeddings/5️⃣: all_disabled_embeddings.pt",          # 仅保留经验相关句子（去除数值）
    # "model_pipeline/embeddings/raw_jd_embeddings.pt",          # raw jd embeddings
]

# ---------------------------
# network configurations
# ---------------------------

# define the network architectures to try

network_configs = [

    # {"hidden_dims": [64], "dropout_rates": [0.3]},
    # {"hidden_dims": [128], "dropout_rates": [0.3]},
    # {"hidden_dims": [256], "dropout_rates": [0.3]},
    # {"hidden_dims": [512], "dropout_rates": [0.3]}, # best for 1 layer
    # {"hidden_dims": [1024], "dropout_rates": [0.3]},

    # {"hidden_dims": [256, 128], "dropout_rates": [0.3, 0.2]},
    # {"hidden_dims": [512, 256, 128], "dropout_rates": [0.3, 0.2, 0.1]},
    # {"hidden_dims": [512, 256, 128], "dropout_rates": [0.4, 0.3, 0.2]},
    # {"hidden_dims": [512, 256, 128], "dropout_rates": [0.5, 0.4, 0.3]},
    # {"hidden_dims": [1024, 512, 256, 128], "dropout_rates": [0.45,0.35,0.25,0.15]},
    {"hidden_dims": [1024, 512, 256, 128], "dropout_rates": [0.4, 0.3, 0.2, 0.1]}, # best
    # {"hidden_dims": [1024, 512, 256, 128], "dropout_rates": [0.35,0.3,0.25,0.2]}, # best

    # {"hidden_dims": [1024, 512, 256, 128], "dropout_rates": [0.3, 0.3, 0.3, 0.3]},
    # {"hidden_dims": [1024, 512, 256, 128], "dropout_rates": [0.2, 0.3, 0.4, 0.5]},
    # {"hidden_dims": [1024, 512, 256, 128], "dropout_rates": [0.5, 0.4, 0.3, 0.2]},
    # {"hidden_dims": [1024, 512, 256, 128, 64], "dropout_rates": [0.5, 0.4, 0.3, 0.2, 0.1]},
    # {"hidden_dims": [1024, 512, 256, 128], "dropout_rates": [0.6, 0.5, 0.4, 0.3]},
   
]

# 是否在计算损失时启用类别平衡权重。
# - True：自动计算每类样本数量，提升少数类（如 Junior）的学习权重；
# - False：所有类别权重相同。
# balanced_class_weights = [True, False]
balanced_class_weights = [False]

# activation = ["relu", "gelu", "leakyrelu"]
# activation = ["relu", "leakyrelu"]
# activation = ["relu", "prelu"]
activation = ["relu"] # best
# activation = ["sigmoid"] # required for 1 layer

# use_batchnorm = [True, False]
use_batchnorm = [False]
# use_layernorm = [True, False]
use_layernorm = [False]



# ---------------------------
# setting for optimizer and learning rate
# ---------------------------

# 选择优化算法：
# - "Adam"：默认推荐，收敛快且稳定；
# - "AdamW"：带权重衰减的 Adam，泛化更好；
# - "SGD"：传统随机梯度下降，训练更慢但结果更平滑。
# optimizer_name = ["Adam", "AdamW" , "SGD"]
# optimizer_name = ["Adam", "AdamW"]
optimizer_name = ["Adam"] # best

# 学习率（Learning Rate）
# - 控制参数更新幅度；
# - 1e-3 是较常见的默认值；
# - 可尝试 5e-4 或 3e-3 做敏感度实验。
# learning_rate = [3e-4, 1e-3, 3e-3]
# learning_rate = [5e-4, 1e-3]
# learning_rate = [1e-3, 5e-4, 7e-4]
# learning_rate = [1e-3, 7e-4]
# learning_rate = [1e-3] # best
learning_rate = [0.001]


# 权重衰减（L2 正则项）
# - 防止过拟合；
# - 通常与 AdamW 一起使用；
# - 可设为 1e-4 观察正则化效果。
# weight_decay = [0, 1e-4]
weight_decay = [0]

use_scheduler = [True]
# use_scheduler = [True, False]
# use_label_smoothing = [True, False]
use_label_smoothing = [False]


# ---------------------------
# training settings
# ---------------------------

# 最大训练轮数。
# - 设置较大值（如 50），因为早停机制会自动终止训练；
# - 实际不会跑满所有轮数。
epochs = 80

# 早停机制的“耐心值”。
# - 当验证集 loss 连续 patience 轮不再下降时停止训练；
# - 通常取 5~10。
patience = 15


for path, net_cfg, opt, lr, wd, act, bn, sch, ul, uls in itertools.product(embedding_paths, network_configs, optimizer_name, learning_rate, weight_decay, activation, use_batchnorm, use_scheduler, use_layernorm, use_label_smoothing):

    print("\n" + "="*120)
    print(f"🔖 Training with config: Batch Size=64, Embedding Path={path}, Hidden Dims={net_cfg['hidden_dims']}, Dropout Rates={net_cfg['dropout_rates']}, Balanced Weights=False, Optimizer={opt}, LR={lr}, WD={wd}, Activation={act}, BatchNorm={bn}, Scheduler={sch}, LayerNorm={ul}, Label Smoothing={uls}")
    print("="*120 + "\n")
    
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


    # ==========================================================
    # Oversampling
    # ==========================================================
    # ros = RandomOverSampler(random_state=42)

    # # 注意：RandomOverSampler 只能处理 numpy 格式
    # X_resampled, y_resampled = ros.fit_resample(train_emb.numpy(), train_labels.numpy())

    # # 再把它们转回 torch 张量
    # train_emb = torch.tensor(X_resampled, dtype=torch.float32)
    # train_labels = torch.tensor(y_resampled, dtype=torch.long)

    # print("✅ After resampling:", {c: sum(train_labels.numpy() == c) for c in np.unique(train_labels.numpy())})

    # ---------------------------
    # data loaders
    # ---------------------------
    train_loader = DataLoader(TensorDataset(train_emb, train_labels), batch_size=64, shuffle=True)
    val_loader = DataLoader(TensorDataset(val_emb, val_labels), batch_size=64)
    test_loader = DataLoader(TensorDataset(test_emb, test_labels), batch_size=64)

    # ---------------------------
    # model definition
    # ---------------------------

    class MLPClassifier(nn.Module):
        def __init__(self, input_dim, num_classes,
                    hidden_dims=[256, 128],
                    dropout_rates=[0.3, 0.2],
                    activation="relu",          # 可选: relu / gelu / leakyrelu
                    use_batchnorm=False,
                    use_layernorm=False):       # 是否启用LayerNorm
            super().__init__()

            layers = []
            prev_dim = input_dim

            # 动态构建每层
            for h_dim, d_rate in zip(hidden_dims, dropout_rates):
                layers.append(nn.Linear(prev_dim, h_dim))
                
                # ✅ 若启用 BatchNorm，放在激活函数前
                if use_batchnorm:
                    layers.append(nn.BatchNorm1d(h_dim))
                if use_layernorm:
                    layers.append(nn.LayerNorm(h_dim))

                # ✅ 动态选择激活函数
                if activation.lower() == "relu":
                    layers.append(nn.ReLU())
                elif activation.lower() == "gelu":
                    layers.append(nn.GELU())
                elif activation.lower() == "leakyrelu":
                    layers.append(nn.LeakyReLU(negative_slope=0.01))
                elif activation.lower() == "prelu":
                    layers.append(nn.PReLU())
                elif activation.lower() == "sigmoid":
                    layers.append(nn.Sigmoid())
                else:
                    raise ValueError(f"Unsupported activation: {activation}")

                layers.append(nn.Dropout(d_rate))
                prev_dim = h_dim

            # 输出层
            layers.append(nn.Linear(prev_dim, num_classes))

            self.net = nn.Sequential(*layers)

        def forward(self, x):
            return self.net(x)



    # -------------------------
    # initialize model
    # -------------------------
    input_dim = train_emb.shape[1]

    # baseline 版本（两层）
    model = MLPClassifier(
        input_dim=input_dim,
        num_classes=len(le.classes_),
        hidden_dims=net_cfg['hidden_dims'],
        dropout_rates=net_cfg['dropout_rates'],
        activation=act,
        use_batchnorm=bn,
        use_layernorm=ul
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
    # define loss function
    # ---------------------------

    # bc = True

    # if bc:
    #     # 计算每个类别的权重
    #     class_weights = compute_class_weight(
    #         class_weight='balanced',
    #         classes=np.unique(train_labels.numpy()),
    #         y=train_labels.numpy()
    #     )
    #     class_weights = torch.tensor(class_weights, dtype=torch.float).to(device)
    # else:
    class_weights = None
    # 使用加权损失函数
    if uls:
        criterion = nn.CrossEntropyLoss(weight=class_weights, label_smoothing=0.1)
    else:
        criterion = nn.CrossEntropyLoss(weight=class_weights)

    # ---------------------------
    # define optimizer and scheduler
    # ---------------------------
    if opt == "Adam":
        optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=wd)
    elif opt == "AdamW":
        optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=wd)
    elif opt == "SGD":
        optimizer = torch.optim.SGD(model.parameters(), lr=lr, momentum=0.9, weight_decay=wd)
    else:
        raise ValueError(f"Unsupported optimizer: {opt}")

    if sch:
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=4)

    # ---------------------------
    # training loop
    # ---------------------------

    # 初始化最优验证集 loss。
    # - 用无穷大（inf）保证第一次比较时任何结果都能被视为“更优”。
    best_val_loss = float('inf')

    # 早停计数器。
    # - 统计验证集连续多少轮未改善；
    # - 达到 patience 值后触发早停。
    patience_counter = 0


    for epoch in range(epochs):

        # start training
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

        # evaluate on validation set
        model.eval()
        val_loss = 0
        with torch.no_grad():
            for X_val, y_val in val_loader:
                X_val, y_val = X_val.to(device), y_val.to(device)
                outputs = model(X_val)
                loss = criterion(outputs, y_val)
                val_loss += loss.item()

        avg_val_loss = val_loss / len(val_loader)
        if sch:
            scheduler.step(avg_val_loss)

        # early stopping check
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            patience_counter = 0
            # save_dir = "model_pipeline"
            # save_path = os.path.join(save_dir, "best_model.pt")
            # torch.save(model.state_dict(), save_path)  # 保存当前最优模型
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"⏹️ Early stopping triggered at epoch {epoch+1}")
                print(f"🧩 Best Val Loss: {best_val_loss:.4f}")
                break
    else:
        print(f"✅ Training finished. Best Val Loss: {best_val_loss:.4f}")

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

    # print("\n📊 Validation Results:")
    # print(classification_report(val_labels.cpu().numpy(), val_preds, target_names=le.classes_))

    # print("\n📊 Test Results:")
    # print(classification_report(test_labels.cpu().numpy(), test_preds, target_names=le.classes_))

    # val_f1 = f1_score(val_labels.cpu().numpy(), val_preds, average="macro")
    # test_f1 = f1_score(test_labels.cpu().numpy(), test_preds, average="macro")
    # val_acc = accuracy_score(val_labels.cpu().numpy(), val_preds)
    # test_acc = accuracy_score(test_labels.cpu().numpy(), test_preds)

    # print(f"\n✅ Validation: Acc={val_acc:.3f}, Macro-F1={val_f1:.3f}")
    # print(f"🧩 Test:       Acc={test_acc:.3f}, Macro-F1={test_f1:.3f}")

    # y_true = test_labels.cpu().numpy()
    # y_pred = test_preds
    # cm = confusion_matrix(y_true, y_pred, labels=range(len(le.classes_)))

    # disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=le.classes_)
    # disp.plot(cmap="Blues", values_format="d")
    # plt.title("Confusion Matrix for Test Set (Best Model)")
    # plt.show()

    all_emb = torch.cat([train_emb, val_emb, test_emb])
    all_labels = torch.cat([train_labels, val_labels, test_labels])

    model.eval()
    with torch.no_grad():
        outputs = model(all_emb.to(device))
        preds = torch.argmax(outputs, dim=1).cpu()

    print("\n=== Classification Report (All Data) ===")
    print(classification_report(all_labels, preds, target_names=le.classes_))

    # cm = confusion_matrix(all_labels, preds, labels=range(len(le.classes_)))
    # disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=le.classes_)
    # disp.plot(cmap="Blues", values_format="d")
    # plt.title("Confusion Matrix for All Data (Best Model)")
    # plt.show()



# load four types of embeddings for sensitivity analysis
data = torch.load("model_pipeline/embeddings/1️⃣: only_exp_num_embeddings.pt")
parts = {
    "Job Title": data["test_title_emb"][:50],
    "Experience + Number": data["test_exp_num_emb"][:50],
    "Salary": data["test_salary_emb"][:50],
    "Experience + Skill": data["test_exp_skill_emb"][:50],
}

# define a prediction function for SHAP
def model_predict(x):
    x_t = torch.tensor(x, dtype=torch.float32).to(device)
    with torch.no_grad():
        y = model(x_t)
        y = torch.softmax(y, dim=1)
    return y.cpu().numpy()

# compute SHAP values for each part
mean_values = {}
for name, emb in parts.items():
    X = emb.cpu().numpy()
    explainer = shap.KernelExplainer(model_predict, X[:10])  
    shap_values = explainer.shap_values(X[:20])              
    mean_values[name] = np.mean(np.abs(shap_values[0]))      
    print(f"{name}: {mean_values[name]:.4f}")

# plot bar chart to compare the importance of four input types
plt.bar(list(mean_values.keys()), list(mean_values.values()), color="skyblue")
plt.ylabel("Mean |SHAP Value|")
plt.title("Sensitivity Analysis by Input Category")
plt.xticks(rotation=20)
plt.tight_layout()
plt.show()