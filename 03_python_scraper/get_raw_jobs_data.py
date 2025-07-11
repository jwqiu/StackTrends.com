import requests
from openpyxl import Workbook
import time
import random
from bs4 import BeautifulSoup
import re
from datetime import datetime
from zoneinfo import ZoneInfo
import psycopg2
from connect import get_conn



base_url = 'https://www.seek.co.nz/api/jobsearch/v5/search?siteKey=NZ-Main&sourcesystem=houston&userqueryid=132bf9afd02e341071614907b92d1843-1679696&userid=c91709f5-a661-49d5-85a9-cb3ad63dff6b&usersessionid=c91709f5-a661-49d5-85a9-cb3ad63dff6b&eventCaptureSessionId=c91709f5-a661-49d5-85a9-cb3ad63dff6b&where=All+New+Zealand&page={}&classification=6281&subclassification=6290,6287,6302&sortmode=ListedDate&pageSize=22&include=seodata,relatedsearches,joracrosslink,gptTargeting,pills&locale=en-NZ&solId=d9cce31f-749c-48c3-aeae-a3d61140f204&relatedSearchesCount=12&baseKeywords='

graphql_url = "https://www.seek.co.nz/graphql"

# wb=Workbook()
# ws=wb.active

# title=['company_id','company_name','job_id','job_title', 'job_url', 'job_des_origin','job_des','sub_id', 'sub_name','location','listed_date','collected_date','listing_year_month']


headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    "Accept": "application/json"
}

import requests

def get_job_details(graphql_url, job_id, headers):
    payload = {
        "operationName": "jobDetails",
        "query": """
        query jobDetails($jobId: ID!, $sessionId: String!, $jobDetailsViewedCorrelationId: String!) {
          jobDetails(
            id: $jobId, 
            tracking: {sessionId: $sessionId, channel: "WEB", jobDetailsViewedCorrelationId: $jobDetailsViewedCorrelationId}
          ) {
            job {
              id
              title
              content(platform: WEB)
            }
          }
        }
        """,
        "variables": {
            "jobId": job_id,
            "sessionId": "fd0c6c24-8e4a-484d-9ca5-3880a9a6376a",
            "jobDetailsViewedCorrelationId": "ba18bdfe-fcde-4c06-894a-64ee37a5167a"
        }
    }
    
    response = requests.post(graphql_url, headers=headers, json=payload)
    
    if response.status_code == 200:
        base_data = response.json()
        job_detail = base_data.get("data", {}).get("jobDetails", {}).get("job", {}).get("content", "NA")
        return job_detail
    else:
        print(f"获取 job {job_id} 详情失败: {response.status_code}")
        return "NA"
    
def clean_html(raw_html):
    soup = BeautifulSoup(raw_html, "html.parser")
    return soup.get_text(separator=" ", strip=True)

def clean_cell(cell):
    if cell is None:
        return None
    s = str(cell)
    # 移除不可见ASCII控制字符
    s = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F]', '', s)
    # 移除Unicode高位代理区间（极少见，但保险）
    s = re.sub(r'[\uD800-\uDFFF]', '', s)
    return s


def to_nz_time(utc_str):
    if utc_str == "NA":
        return "NA"
    try:
        dt_utc = datetime.strptime(utc_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=ZoneInfo("UTC"))
        dt_nz = dt_utc.astimezone(ZoneInfo("Pacific/Auckland"))
        return dt_nz.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return utc_str

def extract_year_month(date_str):
    if date_str == "NA":
        return "NA"
    try:
        # 假设输入已经是 "YYYY-MM-DD HH:MM:SS" 格式
        dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%Y/%m")
    except Exception:
        return "NA"


page = 1
total_job = 0
seen_job_ids = set()
jobs = []

while True:
    url=base_url.format(page)
    print(f"正在爬取{url}")

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        data = response.json() 
        job_list = data.get("data", []) 
        job_num=0

        if not job_list:
            print(f"第 {page} 页没有数据，结束")
            break
        
    
        for job_data in job_list:
            job_id = job_data['id']
            if job_id in seen_job_ids:
                continue
            seen_job_ids.add(job_id)
            job=[]


            raw_id = job_data.get('advertiser', {}).get('id')
            try:
                company_id = int(raw_id)
            except (TypeError, ValueError):
                company_id = None

            job.append(company_id)

            job.append(job_data.get('companyName') or job_data.get('name') or "N/A")
            job.append(job_data['id'])
            job.append(job_data['title'])


            job_id = job_data['id']

            job_url = f"https://www.seek.co.nz/job/{job_id}"      
            job.append(job_url)    

            print(job_id)

            
            # 安全地获取 subclassification 字段
            sub = job_data.get("classifications", [{}])[0].get("subclassification", {})

            job.append(sub.get("id", "NA"))
            job.append(sub.get("description", "NA"))

            # 新增字段
            location = job_data.get("locations", [{}])[0].get("label", "NA")
            job.append(location)
            job.append(to_nz_time(job_data.get("listingDate", "NA")))

            # 新增当前时间
            job.append(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

            job.append(extract_year_month(to_nz_time(job_data.get("listingDate", "NA"))))

            job_html = get_job_details(graphql_url, job_id, headers)
            job.append(job_html)

            job_cleaned = clean_html(job_html)
            job.append(job_cleaned)

            job = [clean_cell(c) for c in job]
            # ws.append(job)
            jobs.append(job)
            job_num=job_num+1

        print(f"第 {page} 页获取到 {job_num} 个 Job信息")
        total_job=total_job+job_num
        page=page+1

    else:
        print(f"第 {page} 页请求失败: {response.status_code}")
        break

    time.sleep(random.uniform(1, 3))


conn = get_conn()
cur = conn.cursor()
create_sql = """
CREATE TABLE IF NOT EXISTS jobs (
    company_id INTEGER,
    company_name TEXT,
    job_id INTEGER PRIMARY KEY,
    job_title TEXT,
    job_url TEXT,
    sub_id INTEGER,
    sub_name TEXT,
    location TEXT,
    listed_date Timestamp,
    collected_date Timestamp,
    listing_year_month TEXT,
    tech_tags TEXT,         
    job_des_origin TEXT,
    job_des TEXT
);
"""
cur.execute(create_sql)
conn.commit()
insert_sql = """
INSERT INTO jobs (
    company_id, company_name, job_id, job_title, job_url, 
    sub_id, sub_name, location, listed_date, collected_date, listing_year_month, job_des_origin, job_des
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (job_id) DO NOTHING;
"""
cur.executemany(insert_sql, jobs)
conn.commit()
cur.close()
conn.close()

print(f"总共获取到 {total_job} 个 Job ID")
print(f"本次新增写入 {cur.rowcount} 条数据到数据库。")

# wb.save('job_list_with_details_0618.xlsx')