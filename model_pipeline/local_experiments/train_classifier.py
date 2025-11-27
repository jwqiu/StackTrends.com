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

# code to ensure reproducibility
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark = False

# ---------------------------
# experiment configurations
# ---------------------------

# set batch size for training
# batch side represents how many samples are fed into the model per training iteration
# larger batch size generally speed up training but use more GPU memory
# smaller batch size may lead to better generalization but slower training
# batch_size = [16, 32, 64]
# batch_size = [32, 64]
batch_size = [64]

# list of embedding file paths
embedding_paths = [
    "model_pipeline/local_experiments/embeddings/1️⃣: only_exp_num_embeddings_new.pt",             # 仅包含“数字+经验”信息的句向量
    "model_pipeline/local_experiments/embeddings/2️⃣: exp_num+exp_embeddings.pt",   # 数字+经验词复合特征
    "model_pipeline/local_experiments/embeddings/3️⃣: exp_num+salary_embeddings.pt",             # 启用全部筛选标准（完整特征）
    # "model_pipeline/local_experiments/embeddings/4️⃣: all_enabled_embeddings.pt",             # 关闭全部筛选标准（控制组）
    # "model_pipeline/local_experiments/embeddings/5️⃣: all_disabled_embeddings.pt",          # 仅保留经验相关句子（去除数值）
    # "model_pipeline/local_experiments/embeddings/raw_jd_embeddings.pt",          # raw jd embeddings
]

# ---------------------------
# network configurations
# ---------------------------

# define the network architectures to try
# how many numbers in hidden_dims means how many layers, eachn number means how many neurons in that layer
# dropout_rates means what precentage of neurons will be randomly dropped in each layer
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

# determine whether to use balanced class weights in loss function
# - True: automatically compute weights inversely proportional to class frequencies to give more importance to minority classes (e.g., Junior);
# - False: all classes have equal weights.
# balanced_class_weights = [True, False]
balanced_class_weights = [False]

# list of activation functions to try
# activation decides how one layer's output is changed before feeding into next layer
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

# optimizer means how the model learns and updates its parameters during training
# optimizer_name = ["Adam", "AdamW" , "SGD"]
# optimizer_name = ["Adam", "AdamW"]
optimizer_name = ["Adam"] # best

# learning rate means how much the weights are updated in each training step
# if the learning rate is too high, the model may jump past the best spot
# if the learning rate is too low, the model may take too long to converge or get stuck in a suboptimal spot
# learning_rate = [3e-4, 1e-3, 3e-3]
# learning_rate = [5e-4, 1e-3]
# learning_rate = [1e-3, 5e-4, 7e-4]
# learning_rate = [1e-3, 7e-4]
# learning_rate = [1e-3] # best
learning_rate = [0.001]

weight_decay = [0]

use_scheduler = [True]
# use_scheduler = [True, False]
# use_label_smoothing = [True, False]
use_label_smoothing = [False]

bc = False # balanced class weights

# ---------------------------
# training settings
# ---------------------------

# total training epochs
epochs = 80

# patience for early stopping
# if the validation loss does not improve for 'patience' consecutive epochs, training will stop early
patience = 15

# ---------------------------
# model definition
# ---------------------------

class MLPClassifier(nn.Module):
    def __init__(self, input_dim, num_classes,
                hidden_dims=[256, 128],
                dropout_rates=[0.3, 0.2],
                activation="relu",          
                use_batchnorm=False,
                use_layernorm=False):       
        super().__init__()

        layers = []
        prev_dim = input_dim

        # zip lets us iterate over both lists in parallel
        for h_dim, d_rate in zip(hidden_dims, dropout_rates):
            layers.append(nn.Linear(prev_dim, h_dim))

            # determine whether to use batchnorm or layernorm
            if use_batchnorm:
                layers.append(nn.BatchNorm1d(h_dim))
            if use_layernorm:
                layers.append(nn.LayerNorm(h_dim))

            # add activation function
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

        # output layer
        # prev_dim is the last hidden layer's size, and num_classes is the number of output classes
        layers.append(nn.Linear(prev_dim, num_classes))
        
        # create the network by stacking all layers
        self.net = nn.Sequential(*layers)

    # this defines how the model processes the input, just pass x through all layers
    def forward(self, x):
        return self.net(x)

if __name__ == "__main__":

    # try all combinations of these hyperparameters
    # for those fixed parameters, we don't need to include them in the product
    for path, net_cfg, opt, lr, wd, act, bn, sch, ul, uls in itertools.product(embedding_paths, network_configs, optimizer_name, learning_rate, weight_decay, activation, use_batchnorm, use_scheduler, use_layernorm, use_label_smoothing):

        print("\n" + "="*120)
        print(f"🔖 Training with config: Batch Size=64, Embedding Path={path}, Hidden Dims={net_cfg['hidden_dims']}, Dropout Rates={net_cfg['dropout_rates']}, Balanced Weights=False, Optimizer={opt}, LR={lr}, WD={wd}, Activation={act}, BatchNorm={bn}, Scheduler={sch}, LayerNorm={ul}, Label Smoothing={uls}")
        print("="*120 + "\n")
        
        # ---------------------------
        # load embeddings and labels
        # ---------------------------

        data = torch.load(path)

        # label encoding, convert string labels to integers
        le = LabelEncoder()
        # first the encoder checks all labes in training set to learn all label categories
        # and assign each category a numeric ID
        # then, it uses this same mapping to convert the labels in the validation and test sets to numbers as well
        train_labels = torch.tensor(le.fit_transform(data["train_labels"]), dtype=torch.long)
        val_labels   = torch.tensor(le.transform(data["val_labels"]), dtype=torch.long)
        test_labels  = torch.tensor(le.transform(data["test_labels"]), dtype=torch.long)
        # for models that use numeric features, we need to normalize or standardize the data to keep all features on a similar scale
        # if one feature has huge values and another has tiny values, the model may focus too much on the large one, scaling makes training more stable and often lead to better performance
        # a feature is basically one piece of information about our data, like "years of experience" or "salary"

        # extract the embeddings for the train, validation and test sets
        train_emb = data["train_emb"]
        val_emb   = data["val_emb"]
        test_emb  = data["test_emb"]

        # ---------------------------
        # Oversampling
        # ---------------------------

        # the training data is imbalanced across different job levels, for example, senior samples are much more than junior ones
        # oversampling is a simple and common technique to balanced the dataset by duplicating the minority-class samples

        # ros = RandomOverSampler(random_state=42)
        # X_resampled, y_resampled = ros.fit_resample(train_emb.numpy(), train_labels.numpy())
        # train_emb = torch.tensor(X_resampled, dtype=torch.float32)
        # train_labels = torch.tensor(y_resampled, dtype=torch.long)
        # print("✅ After resampling:", {c: sum(train_labels.numpy() == c) for c in np.unique(train_labels.numpy())})

        # ---------------------------
        # data loaders
        # ---------------------------

        # what the code here does is to pair each embedding with its corresponding label
        # and then dataloader simply feeds the data to the model in small batches so that it can be trained efficiently
        train_loader = DataLoader(TensorDataset(train_emb, train_labels), batch_size=64, shuffle=True)
        val_loader = DataLoader(TensorDataset(val_emb, val_labels), batch_size=64)
        test_loader = DataLoader(TensorDataset(test_emb, test_labels), batch_size=64)

        # -------------------------
        # initialize model
        # -------------------------

        # get input dimension from embedding size
        input_dim = train_emb.shape[1]
        # we already defined a model class above, now we just need to create an instance of it with the specified configuration
        model = MLPClassifier(
            input_dim=input_dim,
            num_classes=len(le.classes_),
            hidden_dims=net_cfg['hidden_dims'],
            dropout_rates=net_cfg['dropout_rates'],
            activation=act,
            use_batchnorm=bn,
            use_layernorm=ul
        )
        # check if GPU is available, otherwise use CPU
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model.to(device)

        # ---------------------------
        # define loss function
        # ---------------------------
        # loss functions are mathematical formulas that measures the difference between the model's predictions and the actual answers, the model tries to minimize the loss during training

        # determine if we need to compute class weights for imbalanced data
        if bc:
            # the code here calculates class weights so mistakes on rare classes
            class_weights = compute_class_weight(
                class_weight='balanced',
                classes=np.unique(train_labels.numpy()),
                y=train_labels.numpy()
            )
            class_weights = torch.tensor(class_weights, dtype=torch.float).to(device)
        else:
            class_weights = None
            
        # define the loss function with or without label smoothing
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

        # initialize the best validation loss to a infinity so any real loss will be lower
        best_val_loss = float('inf')

        # initialize patience counter for early stopping
        patience_counter = 0

        for epoch in range(epochs):

            # start training
            # this loop goes through the training data batch by batch, runs the model to get predictions, calculates the loss, does backdrop to compute gradients
            # updates the weights with the optimizer and finally calculates the average loss for the whole epoch
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
                save_dir = "model_pipeline/local_experiments"
                save_path = os.path.join(save_dir, "best_model.pt")
                torch.save(model.state_dict(), save_path)  # save the best model
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    print(f"⏹️ Early stopping triggered at epoch {epoch+1}")
                    print(f"🧩 Best Val Loss: {best_val_loss:.4f}")
                    break
        else:
            print(f"✅ Training finished. Best Val Loss: {best_val_loss:.4f}")

        # ---------------------------
        # function to evaluate the model
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

        # -----------------------------------------------------------------------------------
        #  evaluation metrics: classification report, accuracy, f1 score and confusion matrix
        # -----------------------------------------------------------------------------------

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

        # ---------------------------
        #  evaluation result on all data
        # ---------------------------

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

# ---------------------------
# sensitivity analysis
# ---------------------------

# data = torch.load("model_pipeline/local_experiments/embeddings/1️⃣: only_exp_num_embeddings.pt")
# parts = {
#     "Job Title": data["test_title_emb"][:50],
#     "Experience + Number": data["test_exp_num_emb"][:50],
#     "Salary": data["test_salary_emb"][:50],
#     "Experience + Skill": data["test_exp_skill_emb"][:50],
# }

# # define a prediction function for SHAP
# def model_predict(x):
#     x_t = torch.tensor(x, dtype=torch.float32).to(device)
#     with torch.no_grad():
#         y = model(x_t)
#         y = torch.softmax(y, dim=1)
#     return y.cpu().numpy()

# # compute SHAP values for each part
# mean_values = {}
# for name, emb in parts.items():
#     X = emb.cpu().numpy()
#     explainer = shap.KernelExplainer(model_predict, X[:10])  
#     shap_values = explainer.shap_values(X[:20])              
#     mean_values[name] = np.mean(np.abs(shap_values[0]))      
#     print(f"{name}: {mean_values[name]:.4f}")

# # plot bar chart to compare the importance of four input types
# plt.bar(list(mean_values.keys()), list(mean_values.values()), color="skyblue")
# plt.ylabel("Mean |SHAP Value|")
# plt.title("Sensitivity Analysis by Input Category")
# plt.xticks(rotation=20)
# plt.tight_layout()
# plt.show()