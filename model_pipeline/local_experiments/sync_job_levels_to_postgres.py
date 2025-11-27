import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))  # 把项目根目录加入模块搜索路径
from python_scraper.connect import get_conn
import pandas as pd

# ---------------------------
# 1️⃣ 读取 CSV 文件
# ---------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "data-1761440182026.csv")

df = pd.read_csv(CSV_PATH)

# ---------------------------
# 2️⃣ 建立数据库连接
# ---------------------------
conn = get_conn()
cur = conn.cursor()

updated = 0
skipped = 0

# ---------------------------
# 3️⃣ 批量更新 job_level
# ---------------------------
for _, row in df.iterrows():
    job_id = row["job_id"]
    job_level = row["job_level"]

    if pd.isna(job_level) or str(job_level).strip() == "":
        skipped += 1
        continue

    try:
        cur.execute(
            """
            UPDATE jobs_filtered
            SET job_level = %s
            WHERE job_id = %s;
            """,
            (job_level, job_id),
        )
        updated += cur.rowcount  # rowcount=1 表示更新成功
    except Exception as e:
        print(f"⚠️ 更新 job_id={job_id} 时出错: {e}")
        conn.rollback()

# ---------------------------
# 4️⃣ 提交并关闭连接
# ---------------------------
conn.commit()
cur.close()
conn.close()

print(f"✅ 更新完成：成功 {updated} 条，跳过 {skipped} 条。")