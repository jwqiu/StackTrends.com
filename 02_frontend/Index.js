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

function initParticles() {
  tsParticles.load("tsparticles", {
    background: {
      color: { value: "transparent" }
    },
    particles: {
      number: { value: 80 },
      color: { value: "#6B7280" },
      shape: { type: "circle" },
      opacity: { value: 0.5 },
      size: { value: 3 },
      move: { enable: true, speed: 1 },
      links: {
        enable: true,
        distance: 150,
        color: "#9CA3AF",
        opacity: 0.4,
        width: 1
      }
    },
    fullScreen: { enable: false }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  initParticles();
});