const API_BASE = window.API_BASE;
let allTechStacks = [];

document.addEventListener("DOMContentLoaded", async() => {

    await loadTechStacks();
    renderTechStacksByCategory();
    
});

async function loadTechStacks() {
  // 调用后端API获取所有技术栈
  try {
    const response = await fetch(`${API_BASE}/api/TechStack/all`);
    allTechStacks = await response.json();


  } catch (error) {
    console.error('Error loading tech stacks:', error);
  }
}

function renderTechStacksByCategory() {
  if (!allTechStacks || !Array.isArray(allTechStacks)) return;

  // 将分类名转换为容器ID的映射（统一大小写和命名差异）
  const categoryToIdMap = {
    "Frontend": "frontend",
    "Backend": "backend",
    "Coding Methods": "coding-practices",
    "Cloud Platforms": "cloud-platforms",
    "Database": "database",
    "DevOps Tools": "devops-tools",
    "AI": "ai",
    "Other": "other"
  };

  // 清空所有容器内容（除标题）
  Object.values(categoryToIdMap).forEach(id => {
    const container = document.getElementById(id);
    if (container) {
      container.innerHTML = container.querySelector('h5')?.outerHTML || ""; // 保留标题
    }
  });

  // 遍历数据并插入对应容器
  allTechStacks.forEach(stack => {
    const category = stack.category;
    const keyword = stack.stackName || "";

    if (categoryToIdMap[category]) {
      const containerId = categoryToIdMap[category];
      const container = document.getElementById(containerId);
      if (container) {
        const tag = document.createElement("span");
        tag.className = "inline-block bg-gray-100 text-gray-600 text-sm  mr-3 mb-3 px-3 py-2 rounded";
        const capitalizedKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1);
        tag.textContent = capitalizedKeyword;
        container.appendChild(tag);
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("menu-toggle");
  const menu = document.getElementById("menu");

  toggleBtn.addEventListener("click", () => {
    menu.classList.toggle("hidden");
  });
});