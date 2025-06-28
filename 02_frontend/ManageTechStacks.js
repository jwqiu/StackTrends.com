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
      tr.setAttribute('data-id', ts.id);    // 设置 data-id 属性，方便后续编辑和删除操作
      tr.innerHTML = `
        <td class="border px-4 py-2">${ts.id}</td>
        <td class="border px-4 py-2">${ts.category ?? 'N/A'}</td>
        <td class="border px-4 py-2">${ts.stackName ?? 'N/A'}</td>
        <td class="border px-4 py-2">${ts.normalizedStackName ?? 'N/A'}</td>
        <td class="border flex justify-between px-6 py-2">
          <button type="button" class="text-blue-500 hover:underline" onclick="editTechStack(${ts.id})">Edit</button>
          <button type="button" type class="text-blue-500 hover:underline" onclick="deleteTechStack(${ts.id})">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
}

  // ③ 页面加载完毕后启动
document.addEventListener('DOMContentLoaded', loadTechStacks);

async function submitTechStack() {
  // 1. 取表单值
  const category = document.getElementById('category').value;
  const rawKeyword = document.getElementById('raw-keyword').value.trim();
  const normalized = document.getElementById('normalized').value.trim();

  // 2. 简单校验
  if (!category || !rawKeyword) {
    alert('请填写所有字段');
    return;
  }

  // 3. 发送 POST 请求
  const res = await fetch('https://localhost:5001/api/TechStack/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category,
      stackName: rawKeyword,
      normalizedStackName: normalized
    })
  });

  // 4. 处理响应
  if (res.ok) {
    // 清空表单
    document.getElementById('techStackForm').reset();
    // 刷新列表（如果你有这个函数）
    if (typeof loadTechStacks === 'function') {
      await loadTechStacks();
    }
    window.location.reload();
  } else {
    const errText = await res.text();
    alert('提交失败：' + errText);
  }
}

async function deleteTechStack(id) {
  if (!confirm(`确定要删除 ID=${id} 的 TechStack 吗？`)) return;

  try {
    const res = await fetch(`https://localhost:5001/api/TechStack/delete/${id}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      alert('删除成功');
      // 如果你有 loadTechStacks()，刷新列表；否则也可以整页重载 window.location.reload();
      if (typeof loadTechStacks === 'function') {
        await loadTechStacks();
      } else {
        window.location.reload();
      }
    } else if (res.status === 404) {
      alert('未找到该记录，可能已被删除');
    } else {
      const text = await res.text();
      alert(`删除失败：${res.status} ${text}`);
    }
  } catch (err) {
    console.error('请求出错', err);
    alert('删除请求出错，请检查控制台信息');
  }
}

async function editTechStack(id) {
  const tr = document.querySelector(`tr[data-id="${id}"]`);
  if (!tr) return;

  // 把 Category/Raw/Norm 三列换成 input
  const fields = ['category','stackName','normalizedStackName'];
  fields.forEach((f, i) => {
    const td = tr.cells[i+1];
    const val = td.textContent.trim();
    if (f === 'category') {
      td.innerHTML = `
        <select data-field="category"
          class="block w-full appearance-none bg-white border border-gray-300 
                 rounded-lg py-0 px-4 pr-8 hover:border-gray-400 
                 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">— Select —</option>
            <option value="Frontend"        ${val==='Frontend'         ? 'selected' : ''}>Frontend</option>
            <option value="Backend"         ${val==='Backend'          ? 'selected' : ''}>Backend</option>
            <option value="Database"        ${val==='Database'         ? 'selected' : ''}>Database</option>
            <option value="Cloud_Platform"  ${val==='Cloud_Platform'    ? 'selected' : ''}>Cloud Platform</option>
            <option value="DevOps_tools"    ${val==='DevOps_tools'     ? 'selected' : ''}>DevOps Tools</option>
            <option value="API"             ${val==='API'              ? 'selected' : ''}>API</option>
            <option value="Version_Control" ${val==='Version_Control'   ? 'selected' : ''}>Version Control</option>
            <option value="Operating_System" ${val==='Operating_System' ? 'selected' : ''}>Operating System</option>
            <option value="Other"           ${val==='Other'            ? 'selected' : ''}>Other</option>
        </select>
      `;
    } else {
      td.innerHTML = `<input data-field="${f}" value="${val}"
        class="w-full border border-gray-300 rounded-lg px-2 py-1 
               hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400" />`;
    }
  });

  // 把操作列替换成 Save/Cancel
  const actionTd = tr.cells[4];
  actionTd.innerHTML = `
    <button data-action="save" class="text-green-600 hover:underline mr-2">Save</button>
    <button data-action="cancel" class="text-red-600 hover:underline">Cancel</button>
  `;

  // 点击 Save：收集所有 input，然后发 PUT，最后重载列表
  actionTd.querySelector('[data-action="save"]').onclick = async () => {
    const payload = {};
    tr.querySelectorAll('[data-field]').forEach(el => {
      payload[el.dataset.field] = el.value.trim();
    });
    await fetch(`https://localhost:5001/api/TechStack/update/${id}`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    loadTechStacks();
  };

  // 点击 Cancel：直接重载列表，放弃修改
  actionTd.querySelector('[data-action="cancel"]').onclick = () => loadTechStacks();
}
