import requests
from openpyxl import Workbook
import time
import random
from bs4 import BeautifulSoup


base_url = 'https://www.seek.co.nz/api/jobsearch/v5/search?siteKey=NZ-Main&sourcesystem=houston&userqueryid=132bf9afd02e341071614907b92d1843-1679696&userid=c91709f5-a661-49d5-85a9-cb3ad63dff6b&usersessionid=c91709f5-a661-49d5-85a9-cb3ad63dff6b&eventCaptureSessionId=c91709f5-a661-49d5-85a9-cb3ad63dff6b&where=All+New+Zealand&page={}&classification=6281&subclassification=6290,6287,6302&sortmode=ListedDate&pageSize=22&include=seodata,relatedsearches,joracrosslink,gptTargeting,pills&locale=en-NZ&solId=d9cce31f-749c-48c3-aeae-a3d61140f204&relatedSearchesCount=12&baseKeywords='

graphql_url = "https://www.seek.co.nz/graphql"

wb=Workbook()
ws=wb.active

title=['company_id','company_name','job_id','job_title', 'job_url', 'job_des','sub_id', 'sub_name']
ws.append(title)

headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    "Accept": "application/json"
}

total_job=0
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



for page in range(1,26):
    url=base_url.format(page)
    print(f"正在爬取{url}")

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        data = response.json() 
        job_list = data.get("data", []) 
        job_num=0

        if not job_list:
            print(f"第 {page} 页没有数据，提前结束")
            break

        for job_data in job_list:
            job=[]
            
            job.append(job_data['advertiser']['id'])
            job.append(job_data.get('companyName', "NA"))
            job.append(job_data['id'])
            job.append(job_data['title'])


            job_id = job_data['id']

            job_url = f"https://www.seek.co.nz/job/{job_id}"      
            job.append(job_url)    

            print(job_id)

            job_html = get_job_details(graphql_url, job_id, headers)
            job_cleaned = clean_html(job_html)
            job.append(job_cleaned)
            # 安全地获取 subclassification 字段
            sub = job_data.get("classifications", [{}])[0].get("subclassification", {})

            job.append(sub.get("id", "NA"))
            job.append(sub.get("description", "NA"))

            ws.append(job)
            job_num=job_num+1
        print(f"第 {page} 页获取到 {job_num} 个 Job信息")
        total_job=total_job+job_num

    else:
        print(f"第 {page} 页请求失败: {response.status_code}")

    time.sleep(random.uniform(1, 3))

print(f"总共获取到 {total_job} 个 Job ID")

wb.save('job_list_with_details.xlsx')