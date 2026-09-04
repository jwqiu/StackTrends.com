// const API_BASE = window.API_BASE;

document.addEventListener("DOMContentLoaded" ,() => {

    const exploreLink = document.getElementById("exploreLink");
    exploreLink?.addEventListener("click", (event) => {
      if (exploreLink.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
      }
    });

    getLandingSummaryCounts();
    initParticles();

});

function getLandingSummaryCounts() {
  fetch(`${window.API_BASE}/api/stats/landing-summary`)
      // res here represents the response object from fetch
      // convert response to JSON first, then process the data
      .then(res => res.json())
      .then(data => {
          document.getElementById("jobsCount").textContent = data.jobsCount;
          document.getElementById("companiesCount").textContent = data.companyCount;

          const btn = document.getElementById("exploreBtn");
          const link = document.getElementById("exploreLink");
          btn.textContent = "Start exploring";
          link.classList.remove("bg-slate-300", "cursor-not-allowed");
          link.classList.add("bg-blue-600", "hover:bg-blue-700", "hover:-translate-y-0.5", "hover:shadow-lg", "hover:shadow-blue-200");
          link.removeAttribute("aria-disabled");
      
          const hint = document.getElementById("coldStartHint");
          if (hint) {
              hint.style.display = "none";
          }
      })
      .catch(err => console.error("Landing summary fetch failed:", err));
}

// function to initialize the background particles effect
function initParticles() {
  tsParticles.load("tsparticles", {
    background: {
      color: { value: "transparent" }
    },
    particles: {
      number: { value: 80 },
      color: { value: "#475569" },
      shape: { type: "circle" },
      opacity: { value: 0.45 },
      size: { value: { min: 1, max: 3 } },
      move: { enable: true, speed: 0.7 },
      links: {
        enable: true,
        distance: 150,
        color: "#64748B",
        opacity: 0.36,
        width: 1
      }
    },
    fullScreen: { enable: false }
  });
}
