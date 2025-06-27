let allTechStacks = [];

// ① 加载并渲染所有 tech stacks
async function loadTechStacks() {
    try {
        const res = await fetch('https://localhost:5001/api/TechStack/all');
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        allTechStacks = await res.json();
        renderTechStacks();
    } catch (err) {
        console.error('Error loading tech stacks:', err);
    }
}


function renderTechStacks() {
    const tbody = document.querySelector('#tech-stacks-table tbody');
    tbody.innerHTML = '';  // 清空旧行

    allTechStacks.forEach(ts => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="border px-4 py-2">${ts.id}</td>
        <td class="border px-4 py-2">${ts.category ?? 'N/A'}</td>
        <td class="border px-4 py-2">${ts.stackName ?? 'N/A'}</td>
        <td class="border px-4 py-2">${ts.normalizedStackName ?? 'N/A'}</td>
        <td class="border flex justify-between px-6 py-2">
          <button class="text-blue-500 hover:underline" onclick="editTechStack(${ts.id})">Edit</button>
          <button class="text-blue-500 hover:underline" onclick="deleteTechStack(${ts.id})">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
}

  // ③ 页面加载完毕后启动
document.addEventListener('DOMContentLoaded', loadTechStacks);