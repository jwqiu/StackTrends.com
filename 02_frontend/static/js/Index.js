const API_BASE = window.API_BASE;

document.addEventListener("DOMContentLoaded" ,() => {
    // getJobsCount();
    // getCompaniesCount();
    // getTechKeywordsCount();
    getLandingSummaryCounts();
    initParticles();
});

// function getJobsCount() {
//     fetch(`${window.API_BASE}/api/job/count`)
//         .then(res => res.json())
//         .then(data => {
//             document.getElementById("jobsCount").textContent = data.count;
//         })
//         .catch(err => console.error("Job count fetch failed:", err));
// }

// function getCompaniesCount() {
//     fetch(`${window.API_BASE}/api/companies/count`)
//         .then(response => response.json())
//         .then(data => {
//             document.getElementById('companiesCount').innerText = data.count;
//         })
//         .catch(error => console.error('Error fetching companies count:', error));
// }

// function getTechKeywordsCount() {
//     fetch(`${window.API_BASE}/api/techstack/count`)
//         .then(response => response.json())
//         .then(data => {
//             document.getElementById('techKeywordsCount').innerText = data.count;
//         })
//         .catch(error => console.error('Error fetching tech stack count:', error));
// }

function getLandingSummaryCounts() {
    fetch(`${window.API_BASE}/api/stats/landing-summary`)
        .then(res => res.json())
        .then(data => {
            document.getElementById("jobsCount").textContent = data.jobsCount;
            document.getElementById("companiesCount").textContent = data.companyCount;
            document.getElementById("techKeywordsCount").textContent = data.keywordCount;

            const btn = document.getElementById("exploreBtn");
            btn.textContent = "Start Exploring";
            btn.classList.remove("bg-gray-300", "cursor-not-allowed");
            btn.classList.add("bg-blue-600", "hover:bg-blue-800", "hover:scale-105", "transition-colors", "duration-300", "hover:shadow-xl");
            btn.removeAttribute("disabled");
            const hint = document.getElementById("coldStartHint");
            if (hint) {
                hint.style.display = "none";
            }
        })
        .catch(err => console.error("Landing summary fetch failed:", err));
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
