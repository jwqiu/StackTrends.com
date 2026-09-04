// const API_BASE = window.API_BASE;

document.addEventListener("DOMContentLoaded" ,() => {

    document.querySelectorAll("[data-landing-entry]").forEach(entry => {
      entry.addEventListener("click", (event) => {
        if (entry.getAttribute("aria-disabled") === "true") {
          event.preventDefault();
        }
      });
    });

    getLandingSummaryCounts();
    initParticles();

});

function enableLandingEntries() {
  document.querySelectorAll("[data-landing-entry]").forEach(entry => {
    entry.removeAttribute("aria-disabled");
    entry.removeAttribute("tabindex");
    entry.classList.remove("pointer-events-none", "cursor-not-allowed");
  });

  document.querySelectorAll("[data-entry-label]").forEach(label => {
    label.classList.remove("text-slate-400");
    label.classList.add("text-blue-700");
  });
}

function getLandingSummaryCounts() {
  fetch(`${window.API_BASE}/api/stats/landing-summary`)
      // res here represents the response object from fetch
      // convert response to JSON first, then process the data
      .then(res => {
        if (!res.ok) {
          throw new Error(`Landing summary request failed: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
          document.getElementById("jobsCount").textContent = data.jobsCount;
          document.getElementById("companiesCount").textContent = data.companyCount;

          const btn = document.getElementById("exploreBtn");
          const link = document.getElementById("exploreLink");
          btn.textContent = "Start exploring";
          link.classList.remove("bg-slate-300");
          link.classList.add("bg-blue-600", "hover:bg-blue-700", "hover:-translate-y-0.5", "hover:shadow-lg", "hover:shadow-blue-200");
          enableLandingEntries();
      
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
