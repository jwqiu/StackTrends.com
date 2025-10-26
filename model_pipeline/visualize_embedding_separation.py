import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))  # 把项目根目录加入模块搜索路径
from python_scraper.connect import get_conn
import pandas as pd
import re
from typing import Union, Dict, List
from sentence_transformers import SentenceTransformer
import numpy as np
from sklearn.metrics import silhouette_score, calinski_harabasz_score
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from itertools import combinations



def load_job_data():
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs")
    rows = cursor.fetchall()
    if cursor.description is None:
        raise ValueError("No results returned. Check your SQL or table name.")
    colnames = [desc[0] for desc in cursor.description]
    cursor.close()
    conn.close()
    return pd.DataFrame(rows, columns=colnames)

# load the data and filter 100 samples per level, store in sampled_df
df = load_job_data()
levels = ['Junior', 'Intermediate', 'Senior']
dfs = []
for lv in levels:
    filtered = df[df['job_level'] == lv]
    if len(filtered) > 100:
        top100 = filtered.head(100)
        dfs.append(top100)
    else:
        dfs.append(filtered)
sampled_df = pd.concat(dfs, ignore_index=True)

# clean and preprocess the data
des_col  = 'job_des'
level_col = 'job_level'
sampled_df[des_col] = sampled_df[des_col].fillna("").astype(str).str.strip() # fill NaN and strip whitespace, convert to str

# pattern to split sentences
SENT_SPLIT = re.compile(r'(?<=[.!?:;·•|])\s+|\n+')

# pattern to detect sentences that contain the word "experience" along with a number

# pattern_experience_num = re.compile(
#     r'('
#     # 条件 1：包含 experience+数字（含 several） 且 不含 $
#     r'(^(?!.*\$).*?(?:'
#         r'\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|several)\b[^.]{0,50}\bexperience\b'
#         r'|\bexperience\b[^.]{0,50}\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|several)\b'
#     r'))'
#     # 条件 2：包含 intern / graduate / junior / experienced
#     r'|'
#     r'\bintern(ship)?\b'
#     r'|\bgraduate|graduat(e|es|ed|ing)\b'
#     r'|\bjunior\b'
#     r'|\bexperienced\b'
#     r')',
#     re.IGNORECASE
# )

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


# test different input text combination
configs = [
    {"name": "1️⃣: only_exp_num", "use_experience_num": True, "use_salary": False, "use_experience": False},
    {"name": "2️⃣: exp_num+exp", "use_experience_num": True, "use_salary": False, "use_experience": True},
    {"name": "3️⃣: exp_num+salary", "use_experience_num": True, "use_salary": True, "use_experience": False},
    {"name": "4️⃣: all_enabled", "use_experience_num": True, "use_salary": True, "use_experience": True},
    {"name": "5️⃣: all_disabled", "use_experience_num": False, "use_salary": False, "use_experience": False},
]

sampled_df_original = sampled_df.copy()

for cfg in configs:

    print("=" * 100)
    print(f"Running configuration: {cfg['name']}")
    print("=" * 100)

    sampled_df = sampled_df_original.copy()

    # apply the extraction function to each job description based on the current configuration
    sampled_df["des_filtered"] = sampled_df[des_col].apply(
        lambda x: extract_requirement_text(
            x,
            use_experience=cfg["use_experience"],
            use_experience_num=cfg["use_experience_num"],
            use_salary=cfg["use_salary"]
        )
    )

    # assign empty string if no matched sentences
    sampled_df["des_filtered"] = sampled_df["des_filtered"].fillna("")

    # combine job title and filtered description
    sampled_df["title_plus_des"] = (
        "This job title is " + sampled_df["job_title"].astype(str) + ". " +
        sampled_df["des_filtered"].astype(str)
    )

    # print the first 5 extracted results for debugging and case study
    print("\n=== DEBUG: 前 5 条提取结果 (matched) ===")
    for i, text in enumerate(sampled_df["des_filtered"].sample(5), start=1):
        print(f"\n[{i}] {text}\n")
    print("=== END DEBUG ===\n")

    # extract texts and corresponding job levels labels for embedding and visualization later
    texts  = sampled_df["title_plus_des"].tolist()
    labels = sampled_df[level_col].astype(str).tolist()
    uniq   = list(dict.fromkeys(labels))
    y      = [uniq.index(lv) for lv in labels]

    # compared candidate models
    candidate_models = [
        # "TechWolf/JobBERT-v3",
        # "sentence-transformers/all-MiniLM-L6-v2",
        # "sentence-transformers/all-mpnet-base-v2",
        "intfloat/e5-large-v2"
    ]

    for model_name in candidate_models:

        print(f"Starting evaluation for model: {model_name}")
        # pick a model and encode the texts
        model = SentenceTransformer(model_name, device="cpu")
        X = model.encode(texts, show_progress_bar=True)

        # 3.1 Silhouette
        # measure how well embeddings are clustered according to job levels
        try:
            sil = silhouette_score(X, y, metric="euclidean")
        except Exception as e:
            sil = float("nan")
            print(f"[INFO] Silhouette 跳过：{e}")

        # 3.2 Calinski–Harabasz
        # ratio of between-class to within-class variance
        try:
            ch = calinski_harabasz_score(X, y)
        except Exception as e:
            ch = float("nan")
            print(f"[INFO] CH 跳过：{e}")

        print(f"Silhouette (higher better): {sil:.3f}")
        print(f"Calinski–Harabasz (higher better): {ch:.1f}")

        # 3.3 Pairwise MMD^2 + permutation p-values
        # compares embedding distributions between classes.
        def rbf_kernel(X, Y=None, gamma=None):
            if Y is None: Y = X
            if gamma is None:
                Z = np.vstack([X, Y])
                d = np.sqrt(((Z[:,None,:]-Z[None,:,:])**2).sum(axis=2))
                med = np.median(d[d>0])
                gamma = 1.0 / (2*(med**2 + 1e-12))
            XX = ((X[:,None,:]-X[None,:,:])**2).sum(axis=2)
            YY = ((Y[:,None,:]-Y[None,:,:])**2).sum(axis=2)
            XY = ((X[:,None,:]-Y[None,:,:])**2).sum(axis=2)
            return np.exp(-gamma*XX), np.exp(-gamma*YY), np.exp(-gamma*XY)

        def mmd2_unbiased(Xa, Xb, gamma=None):
            Kxx, Kyy, Kxy = rbf_kernel(Xa, Xb, gamma)
            n = len(Xa); m = len(Xb)
            if n > 1: np.fill_diagonal(Kxx, 0.0)
            if m > 1: np.fill_diagonal(Kyy, 0.0)
            term_x = Kxx.sum() / (n*(n-1)) if n > 1 else 0.0
            term_y = Kyy.sum() / (m*(m-1)) if m > 1 else 0.0
            term_xy = 2.0 * Kxy.mean()
            return float(term_x + term_y - term_xy)

        def permutation_p_value_two_class(Xa, Xb, n_perm=300, seed=42):
            rng = np.random.default_rng(seed)
            Xab = np.vstack([Xa, Xb])
            n   = len(Xa)
            s_obs = mmd2_unbiased(Xa, Xb)
            cnt = 0
            for _ in range(n_perm):
                idx = rng.permutation(len(Xab))
                Xa_p = Xab[idx[:n]]
                Xb_p = Xab[idx[n:]]
                s_p  = mmd2_unbiased(Xa_p, Xb_p)
                if s_p >= s_obs:    # 右尾：越大越“不同”
                    cnt += 1
            p = (cnt + 1) / (n_perm + 1)
            return s_obs, p

        print("\nPairwise MMD^2 (RBF) with permutation p-values:")
        y = np.array(y)
        for a, b in combinations(range(len(uniq)), 2):
            Xa = X[y==a]; Xb = X[y==b]
            if len(Xa) < 2 or len(Xb) < 2:
                print(f"{uniq[a]} vs {uniq[b]} : 样本不足，跳过")
                continue
            mmd2, p = permutation_p_value_two_class(Xa, Xb, n_perm=300, seed=42)
            print(f"{uniq[a]} vs {uniq[b]} : MMD^2={mmd2:.4f},  p={p:.4f}")

        # 3.4 Visualization with PCA and t-SNE
        os.makedirs("model_pipeline/emb_plots", exist_ok=True)

        # --- PCA 2D ---
        pca = PCA(n_components=2, random_state=42)
        X_pca = pca.fit_transform(X)

        # --- t-SNE 2D ---
        tsne = TSNE(n_components=2, random_state=42, perplexity=30, init="pca")
        X_tsne = tsne.fit_transform(X)

        colors = {'Junior': 'red', 'Intermediate': 'green', 'Senior': 'blue'}

        def plot_and_save(X2, title, fname):
            plt.figure(figsize=(6, 5))
            for lv in uniq:
                idx = [i for i, l in enumerate(labels) if l == lv]
                plt.scatter(X2[idx, 0], X2[idx, 1],
                            s=10, c=colors[lv], label=lv, alpha=0.7)
            plt.title(title)
            plt.xlabel("Dim 1"); plt.ylabel("Dim 2")
            plt.legend()
            plt.tight_layout()
            plt.savefig(fname, dpi=150)
            plt.close()

        # 加上 config 名称到文件名中
        plot_and_save(
            X_pca,
            f"PCA — {model_name} ({cfg['name']})",
            f"model_pipeline/emb_plots/PCA_{model_name.replace('/', '_')}_{cfg['name'].replace(' ', '_')}.png"
        )

        plot_and_save(
            X_tsne,
            f"t-SNE — {model_name} ({cfg['name']})",
            f"model_pipeline/emb_plots/TSNE_{model_name.replace('/', '_')}_{cfg['name'].replace(' ', '_')}.png"
        )

        print(f"✅ Saved PCA & t-SNE plots for {model_name} ({cfg['name']}) in model_pipeline/emb_plots/")