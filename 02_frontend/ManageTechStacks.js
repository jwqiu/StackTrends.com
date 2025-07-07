const API_BASE = window.API_BASE;
let allTechStacks = [];

// ① 加载并渲染所有 tech stacks
async function loadTechStacks() {
    try {
        const res = await fetch('https://stacktrends-api-cshjb2ephxbjdffa.newzealandnorth-01.azurewebsites.net/api/TechStack/all');
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
  const res = await fetch('https://stacktrends-api-cshjb2ephxbjdffa.newzealandnorth-01.azurewebsites.net/api/TechStack/add', {
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
    const res = await fetch(`https://stacktrends-api-cshjb2ephxbjdffa.newzealandnorth-01.azurewebsites.net/api/TechStack/delete/${id}`, {
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
  const tr = document.querySelector(`#tech-stacks-body tr[data-id="${id}"]`);
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
          ${
            allCategories.map(cat =>
              `<option value="${cat.name}" ${val === cat.name ? 'selected' : ''}>
                ${cat.name}
              </option>`
            ).join('')
          }
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
    await fetch(`https://stacktrends-api-cshjb2ephxbjdffa.newzealandnorth-01.azurewebsites.net/api/TechStack/update/${id}`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    loadTechStacks();
  };

  // 点击 Cancel：直接重载列表，放弃修改
  actionTd.querySelector('[data-action="cancel"]').onclick = () => loadTechStacks();
}

function setupMenuToggle() {
  const menuCategory = document.getElementById('menu-category');
  const menuStack = document.getElementById('menu-stack');
  const categoryDiv = document.getElementById('category-panel');
  const stackKeywordDiv = document.getElementById('stack-keyword-panel');

  if (!menuCategory || !menuStack || !categoryDiv || !stackKeywordDiv) return;

  menuCategory.addEventListener('click', (e) => {
    e.preventDefault();
    categoryDiv.style.display = 'block';
    stackKeywordDiv.style.display = 'none';
  });

  menuStack.addEventListener('click', (e) => {
    e.preventDefault();
    categoryDiv.style.display = 'none';
    stackKeywordDiv.style.display = 'block';
  });
}

document.addEventListener('DOMContentLoaded', setupMenuToggle);

let allCategories = [];

async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/api/category`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // 假设后端返回的是 { id, name, groupName } 数组
    const categories = await res.json();

    allCategories = categories;

    const tbody = document.getElementById('category-table-body');
    tbody.innerHTML = '';

    categories.forEach(({ id,name, groupName }, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50';
      tr.dataset.id = id;   // ← 这一行把 id 绑到 DOM 节点上

      const tdIdx = document.createElement('td');
      tdIdx.className = 'px-4 py-2';
      tdIdx.textContent = idx + 1;

      const tdName = document.createElement('td');
      tdName.className = 'px-4 py-2';
      tdName.textContent = name;

      const tdGroup = document.createElement('td');
      tdGroup.className = 'px-4 py-2';
      tdGroup.textContent = groupName;

      // Actions 列
      const tdActions = document.createElement('td');
      tdActions.className = 'px-4 py-2 space-x-2';

      // Edit 按钮
      const btnEdit = document.createElement('button');
      btnEdit.textContent = 'Edit';
      btnEdit.className = 'text-blue-600 hover:text-blue-800';
      btnEdit.addEventListener('click', () => editCategory(id));

      // Delete 按钮
      const btnDelete = document.createElement('button');
      btnDelete.textContent = 'Delete';
      btnDelete.className = 'text-red-600 hover:text-red-800';
      btnDelete.addEventListener('click', () => deleteCategory(id));

      tdActions.append(btnEdit, btnDelete);

      tr.append(tdIdx, tdName, tdGroup, tdActions);
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Load categories failed:', err);
    // TODO: 你也可以在页面上显示一个错误提示
  }
}

document.addEventListener('DOMContentLoaded', loadCategories);

function setupAddCategoryForm() {
  const form = document.getElementById('add-category-form');
  const inputName = document.getElementById('category-name-input');
  const inputGroup = document.getElementById('group-name-input');

  if (!form || !inputName || !inputGroup) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = inputName.value.trim();
    const groupName = inputGroup.value.trim();

    if (!name || !groupName) {
      alert('Category Name and Group Name cannot be empty.');
      return;
    }

    try {
      const res = await fetch(`${window.API_BASE}/api/category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, groupName })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Error ${res.status}: ${text}`);
      }

      alert('Category added successfully.');
      inputName.value = '';
      inputGroup.value = '';

      // 如果定义了 loadCategories()，则刷新列表
      if (typeof loadCategories === 'function') {
        loadCategories();
      }
    } catch (err) {
      console.error('Add category failed:', err);
      alert(`Failed to add category: ${err.message}`);
    }
  });
}

// 页面加载后调用
document.addEventListener('DOMContentLoaded', setupAddCategoryForm);

async function editCategory(id) {
  console.log('editCategory invoked, id =', id);
  // 1. 找到对应的 <tr data-id="...">
  const tr = document.querySelector(`#category-table-body tr[data-id="${id}"]`);
  if (!tr) return;
  console.log('Found row:', tr);
  // 2. 缓存原始显示值
  const origName  = tr.cells[1].textContent.trim();
  const origGroup = tr.cells[2].textContent.trim();

  // 3. 把“名称”和“分组”两列替换成 <input>
  tr.cells[1].innerHTML = `
    <input data-field="name" value="${origName}"
      class="w-full border border-gray-300 rounded-lg px-2 py-1
             hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400" />
  `;
  tr.cells[2].innerHTML = `
    <input data-field="groupName" value="${origGroup}"
      class="w-full border border-gray-300 rounded-lg px-2 py-1
             hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400" />
  `;

  // 4. 把操作列替换成 Save/Cancel
  const actionTd = tr.cells[3];
  actionTd.innerHTML = `
    <button data-action="save" class="text-green-600 hover:underline mr-2">Save</button>
    <button data-action="cancel" class="text-red-600 hover:underline">Cancel</button>
  `;

  // 5. Save：收集 input 值，PUT 到后端，然后 reload
  actionTd.querySelector('[data-action="save"]').onclick = async () => {
    // 收集两个输入框的值
    const payload = {};
    tr.querySelectorAll('input[data-field]').forEach(el => {
      payload[el.dataset.field] = el.value.trim();
    });

    try {
      const res = await fetch(`${window.API_BASE}/api/category/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // 成功后重新加载列表
      loadCategories();
    } catch (err) {
      console.error('Update failed:', err);
      alert(`Update failed: ${err.message}`);
    }
  };

  // 6. Cancel：还原到原始文本 + 恢复 Edit/Delete 按钮
  actionTd.querySelector('[data-action="cancel"]').onclick = () => {
    tr.cells[1].textContent = origName;
    tr.cells[2].textContent = origGroup;
    actionTd.innerHTML = `
      <button class="text-blue-600 hover:text-blue-800"
              onclick="editCategory(${id})">Edit</button>
      <button class="text-red-600 hover:text-red-800"
              onclick="deleteCategory(${id})">Delete</button>
    `;
  };
}

async function deleteCategory(id) {
  if (!confirm('Are you sure you want to delete this category?')) return;

  try {
    const res = await fetch(`${API_BASE}/api/category/${id}`, {
      method: 'DELETE'
    });
    if (res.status === 204) {
      // 删除成功，刷新列表
      loadCategories();
    } else if (res.status === 404) {
      alert('Category not found!');
    } else {
      const errMsg = await res.text();
      alert('Delete failed: ' + errMsg);
    }
  } catch (err) {
    console.error('Delete failed:', err);
    alert('Delete failed: ' + err.message);
  }
}

function initSidebarMenuHighlight() {
  const menuItems = [
    document.getElementById('menu-category'),
    document.getElementById('menu-stack')
  ];

  menuItems.forEach(item => {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      menuItems.forEach(i => i.classList.remove('bg-blue-100', 'text-blue-500', ));
      this.classList.add('bg-blue-100', 'text-blue-500', );
    });
  });

  // 可选：默认选中第一个
  menuItems[0].classList.add('bg-blue-100', 'text-blue-500', );
}

// 页面加载后调用
document.addEventListener('DOMContentLoaded', initSidebarMenuHighlight);

async function loadCategoryOptions() {
    const select = document.getElementById('category');
    select.innerHTML = '<option value="" disabled selected>Select a category</option>';
    const res = await fetch(`${API_BASE}/api/category`);
    const cats = await res.json();
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
  }

document.addEventListener('DOMContentLoaded', loadCategoryOptions);

document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("menu-toggle");
  const menu = document.getElementById("menu");

  toggleBtn.addEventListener("click", () => {
    menu.classList.toggle("hidden");
  });
});