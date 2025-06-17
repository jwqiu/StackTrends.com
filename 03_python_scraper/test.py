import requests
from openpyxl import Workbook
import time

base_url='https://www.seek.co.nz/api/jobsearch/v5/search?siteKey=NZ-Main&sourcesystem=houston&userqueryid=132bf9afd02e341071614907b92d1843-1679696&userid=c91709f5-a661-49d5-85a9-cb3ad63dff6b&usersessionid=c91709f5-a661-49d5-85a9-cb3ad63dff6b&eventCaptureSessionId=c91709f5-a661-49d5-85a9-cb3ad63dff6b&where=All+New+Zealand&page={}&classification=6281&sortmode=ListedDate&pageSize=22&include=seodata,relatedsearches,joracrosslink,gptTargeting,pills&locale=en-NZ&solId=d9cce31f-749c-48c3-aeae-a3d61140f204&relatedSearchesCount=12&baseKeywords='

graphql_url = "https://www.seek.co.nz/graphql"

headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    "Accept": "application/json"
}

test_job_id = "82561464"  # 这里随便填一个 job_id
test_payload = {
    "operationName": "jobDetails",
    "query": """
    query jobDetails($jobId: ID!, $sessionId: String!, $jobDetailsViewedCorrelationId: String!) {
      jobDetails(id: $jobId, tracking: {sessionId: $sessionId, channel: "WEB", jobDetailsViewedCorrelationId: $jobDetailsViewedCorrelationId}) {
        job {
          id
          title
          content(platform: WEB)
        }
      }
    }
    """,
    "variables": {
        "jobId": test_job_id,
        "sessionId": "fd0c6c24-8e4a-484d-9ca5-3880a9a6376a",
        "jobDetailsViewedCorrelationId": "ba18bdfe-fcde-4c06-894a-64ee37a5167a"
    }
}



test_response = requests.post(graphql_url, headers=headers, json=test_payload)
print("Status Code:", test_response.status_code)
print("Response Data:", test_response.text)
