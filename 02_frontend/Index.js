document.addEventListener("DOMContentLoaded" ,() => {
    getJobsCount();
    getCompaniesCount();
    getTechKeywordsCount();
});

function getJobsCount() {
    fetch(`${window.API_BASE}/api/job/count`)
        .then(res => res.json())
        .then(data => {
            document.getElementById("jobsCount").textContent = data.count;
        })
        .catch(err => console.error("Job count fetch failed:", err));
}

function getCompaniesCount() {
    fetch(`${window.API_BASE}/api/companies/count`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('companiesCount').innerText = data.count;
        })
        .catch(error => console.error('Error fetching companies count:', error));
}

function getTechKeywordsCount() {
    fetch(`${window.API_BASE}/api/techstack/count`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('techKeywordsCount').innerText = data.count;
        })
        .catch(error => console.error('Error fetching tech stack count:', error));
}