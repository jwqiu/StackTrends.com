// const API_BASE = window.API_BASE;
let allTechStacks = [];

document.addEventListener("DOMContentLoaded", async() => {

  await loadTechStacks();
  renderTechStacksByCategory();
  setupToggleBtnClickEvent();
  fetchLoginModal();
  setupAdminLinkClickEvent();
    
});


async function loadTechStacks() {
  // 调用后端API获取所有技术栈
  try {
    const response = await fetch(`${API_BASE}/api/keywords/list`);
    allTechStacks = await response.json();


  } catch (error) {
    console.error('Error loading tech stacks:', error);
  }
}

function renderTechStacksByCategory() {
  if (!allTechStacks || !Array.isArray(allTechStacks)) return;

  const categoryToIdMap = {
    "Frontend": "frontend",
    "Backend": "backend",
    "Coding Methods and Practices": "coding-practices",
    "Cloud Platforms": "cloud-platforms",
    "Database": "database",
    "DevOps Tools": "devops-tools",
    "AI": "ai",
    "Other": "other"
  };

  // clear existing content in all category if any
  Object.values(categoryToIdMap).forEach(id => {
    // already have these containers in HTML
    const container = document.getElementById(id);
    if (container) {
      container.innerHTML = container.querySelector('h5')?.outerHTML || ""; // 保留标题
    }
  });

  // render tags into their respective category containers
  allTechStacks.forEach(stack => {
    const category = stack.category;
    const keyword = stack.stackName || "";

    if (categoryToIdMap[category]) {
      const containerId = categoryToIdMap[category];
      const container = document.getElementById(containerId);
      if (container) {
        const tag = document.createElement("span");
        tag.className = "inline-block font-mono bg-gray-100 text-gray-600 text-sm  mr-3 mb-3 px-3 py-2 rounded";
        const capitalizedKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1);
        tag.textContent = capitalizedKeyword;
        container.appendChild(tag);
      }
    }
  });
}

function setupToggleBtnClickEvent(){

  const toggleBtn = document.getElementById("menu-toggle");
  const menu = document.getElementById("menu");

  toggleBtn.addEventListener("click", () => {
    // toggle is a built-in method of classList, in this example
    // if hidden already exists in the classList, it will be removed
    // if it doesn't exist, it will be added
    menu.classList.toggle("hidden");
  });

}

// =================================================
// functions for handling admin login
// =================================================

function fetchLoginModal(){
  fetch("login-modal.html")
    .then(res=>res.text())
    .then(html=>{
      document.getElementById("modalContainer").innerHTML = html;
    })
}

function setupAdminLinkClickEvent() {
  document.getElementById("adminLink").addEventListener("click", (e) => {
      e.preventDefault();
      checkAndEnterAdminPage();
  })
}
