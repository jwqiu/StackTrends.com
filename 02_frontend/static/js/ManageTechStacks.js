// const API_BASE = window.API_BASE;
let allTechStacks = [];
let allCategories = [];

document.addEventListener('DOMContentLoaded',  () => {
  enforceLogin(), // check login status first
  loadTechStacks(),
  setupMenu(),
  loadCategories(),
  setupAddCategoryForm(),
  loadCategoryOptions(),
  renderAdminUI(), 
  getLandingSummaryCounts(),
  renderJobsChart(),
  setupToggleBtnClickEvent(),
  fetchLoginModal(),
  setupAdminLinkClickEvent()
}); 

// ======================================================
// admin menu setup functions
// ======================================================

function setupMenu() {
  
  const mapping = {
    'menu-dashboard': 'dashboard-panel',
    'menu-category': 'category-panel',
    'menu-stack': 'stack-keyword-panel'
  };
  
  // get menu items and panels by their IDs, store in arrays 
  const menuItems = Object.keys(mapping).map(id => document.getElementById(id));
  const panels = Object.values(mapping).map(id => document.getElementById(id));

  menuItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();

      // remove all highlights class for all menu items, then add it to the clicked one
      menuItems.forEach(i => i.classList.remove('bg-blue-500','text-white'));
      item.classList.add('bg-blue-500','text-white');

      // hide all panels first
      panels.forEach(p => p.style.display = 'none');
      // item here is the clicked menu item, item.id gets its HTML id attribute, mapping[item.id] gets the corresponding panel ID
      // set this panel to display block
      document.getElementById(mapping[item.id]).style.display = 'block';
    });
  });

  // default to show the first menu item and panel
  menuItems[0].classList.add('bg-blue-500','text-white');
  panels.forEach(p => p.style.display = 'none');
  document.getElementById(mapping[menuItems[0].id]).style.display = 'block';
}

function renderAdminUI() {
  
  const isAdmin = sessionStorage.getItem('isAdmin');
  
  if (!isAdmin) {
    // if isAdmin is null or undefined
    const adminContainer = document.getElementById('adminContainer');
    adminContainer.innerHTML = `Please log in ! ❌`;
    adminContainer.classList.add('text-gray-600', 'text-center');
    return;

  } else if (isAdmin === 'true') {

    const adminTab = document.getElementById('adminTab');
    // 普通按钮
    adminTab.textContent = '🔑Admin';
    const adminName = sessionStorage.getItem('Username');
    const adminNameTitle = document.getElementById('adminNameTitle');
    if (adminNameTitle) { 
      adminNameTitle.textContent = `${adminName}`;
    }
  }
}

function logout() {

  fetch(`${window.API_BASE}/api/account/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionStorage.getItem("jwt")}`
    }
  }).then(() => {
    sessionStorage.removeItem("jwt");
    sessionStorage.removeItem("isAdmin");
    sessionStorage.removeItem("Username");
    location.reload();
  });
}

// ======================================================
// admin dashboard functions
// ======================================================

function getLandingSummaryCounts() {

  fetch(`${window.API_BASE}/api/stats/landing-summary`)
    .then(res => res.json())
    .then(data => {
        document.getElementById("jobsCount").textContent = data.jobsCount;
        document.getElementById("companiesCount").textContent = data.companyCount;
        document.getElementById("techKeywordsCount").textContent = data.keywordCount;

    })
    .catch(err => console.error("Landing summary fetch failed:", err));
}

async function renderJobsChart() {
  try {
    
    const res = await fetch(`${API_BASE}/api/stats/jobs/month`);
    const data = await res.json();

    // loop through each data point to extract time and counts, store in arrays
    const labels = data.map(d => d.yearMonth);
    const counts = data.map(d => d.count);

    const ctx = document.getElementById('jobsChart');
    if (!ctx) {
      console.error("jobsChart canvas not found");
      return;
    }

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Jobs Count per Month',
          data: counts,
          backgroundColor: 'rgba(59, 130, 246, 0.7)', // Tailwind 蓝
          borderColor: 'rgba(37, 99, 235, 1)',        // 深蓝
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Job Postings by Month'
          },
          datalabels: {
            anchor: 'end',
            align: 'end',
            color: '#2c2e33ff',
            font: { weight: '' },
            formatter: (value) => value
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Year/Month' }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Jobs Count' }
          }
        }
      },
      plugins: [ChartDataLabels] // ⬅️ 注册 datalabels 插件
    });
  } catch (err) {
    console.error("Failed to load jobs chart:", err);
  }
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

// ======================================================
// tech keywords management functions
// ======================================================

async function loadTechStacks() {
    try {
        const res = await fetch(`${API_BASE}/api/techstacks/list`);
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        allTechStacks = await res.json();
        renderTechStacks();
    } catch (err) {
        console.error('Error loading tech stacks:', err);
    }
}

function renderTechStacks() {
  // querySelector accepts any CSS selector, so we can freely use a mix of IDs, classes, and tag names
  const tbody = document.querySelector('#tech-stacks-table tbody');
  tbody.innerHTML = '';  // 清空旧行

  // sort the teck stack list by id, and make the latest ones appear on top
  // this is a super weird way to sort the list in JS
  // if this expression returns a positive number, b will be placed before a
  allTechStacks.sort((a, b) => b.id - a.id);

  allTechStacks.forEach(ts => {
    const tr = document.createElement('tr');
    // In real projects, if a table row can be edited, deleted, viewed in detail, or updated, it's a good practice to set a data-id attribute
    // because we need the data-id to identiy which specific item we want to modify
    tr.setAttribute('data-id', ts.id);    // 设置 data-id 属性，方便后续编辑和删除操作
    tr.className = 'hover:bg-gray-50';
    // need to use ${...} when we are using a template string, the one with backticks `...`
    tr.innerHTML = `
      <td class="border px-4 py-2">${ts.id}</td>
      <td class="border px-4 py-2">${ts.category ?? 'N/A'}</td>
      <td class="border px-4 py-2">${ts.stackName ?? 'N/A'}</td>
      <td class="border px-4 py-2">${ts.normalizedStackName ?? 'N/A'}</td>
      <td class=" flex justify-between items-center space-x-2 px-6 py-2">
        <button type="button" class="text-blue-500 hover:underline" onclick="editTechStack(${ts.id})">Edit</button>
        <button type="button" type class="text-red-500 hover:underline" onclick="deleteTechStack(${ts.id})">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function submitTechStack() {
  // 1. Get form values
  const category = document.getElementById('category').value;
  const rawKeyword = document.getElementById('raw-keyword').value.trim();
  const normalized = document.getElementById('normalized').value.trim();

  // 2. Simple validation
  if (!category || !rawKeyword) {
    alert('Please fill in all fields');
    return;
  }

  // 3. Send POST request
  const res = await fetch(`${API_BASE}/api/techstacks/add`, {
    method: 'POST',
    // always include the token in the headers when requesting/calling a protected API
    // the token is stored in sessionStorage after login
    // if sending JSON data, add 'Content-Type': 'application/json' header
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionStorage.getItem('jwt')}`  
     }, 
    // we usually use JSON when we are sending structured data, like objects or arrays
    // but if we are sending files, we use FormData instead
    // and for GET requests, we just put the data in the URL
    body: JSON.stringify({
      category,
      stackName: rawKeyword,
      normalizedStackName: normalized
    })
  });

  // 4. Handle response
  if (res.ok) {
    // if success, clear the data we entered in the form
    document.getElementById('techStackForm').reset();
    // if success, refresh the list (if you have this function)
    await loadTechStacks();
    // window.location.reload(); // if need to reload the whole page, uncomment this line
  } else if (res.status === 401) {
    document.getElementById("loginModal").classList.remove("hidden");
  } else {
    const errText = await res.text();
    alert('error message: ' + errText);
  }
}

async function deleteTechStack(id) {
  
  const item = allTechStacks.find(ts => ts.id === id);
  const keyword = item ? item.stackName : 'N/A';

  if (!confirm(`Are you sure you want to delete this tech keyword ID=${id}, Keyword=${keyword} ?`)) return;

  try {
    // for DELETE requests, we usually don't need a body and Content-Type header
    const res = await fetch(`${API_BASE}/api/techstacks/delete/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('jwt')}`
      }
    });

    if (res.ok) {
      alert('Delete successful');
      // refresh the list
      await loadTechStacks();
      // window.location.reload(); // no need to reload the whole page, just reload the list
      
    } else if (res.status === 404) {
      alert('Record not found, it may have been deleted');
    } else if (res.status === 401) {
      document.getElementById("loginModal").classList.remove("hidden");
  } else {
      const text = await res.text();
      alert(`Delete failed: ${res.status} ${text}`);
    }
  } catch (err) {
    console.error('Request error', err);
    alert('Delete request error, please check console for details');
  }
}

async function editTechStack(id) {
  
  // the # here means we are selecting an element by its ID, and . means by class
  // the #tech-stacks-body used here is to narrow down the search scope to avoid conflicts
  const tr = document.querySelector(`#tech-stacks-body tr[data-id="${id}"]`);
  if (!tr) return;

  // replace the relevant td elements with input fields
  const fields = ['category','stackName','normalizedStackName'];
  fields.forEach((f, i) => {
    // skip the first column (ID)
    const td = tr.cells[i+1];
    // save the original value, we will need it if user clicks cancel
    const val = td.textContent.trim();
    if (f === 'category') {
      td.innerHTML = `
        <select data-field="category"
          class="block w-full appearance-none bg-white border border-gray-300 
                 rounded-lg py-0 px-4 pr-8 hover:border-gray-400 
                 focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">— Select —</option>
          ${
            // example : <option value="Frontend" selected>   Frontend </option>
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

  // replace the action buttons with save/cancel buttons
  const actionTd = tr.cells[4];
  actionTd.innerHTML = `
    <button data-action="save" class="text-green-600 hover:underline mr-2">Save</button>
    <button data-action="cancel" class="text-red-600 hover:underline">Cancel</button>
  `;

  // we use actionTd here rather than document querySelector to narrow down the search scope
  actionTd.querySelector('[data-action="save"]').onclick = async () => {
    // payload means the actual data we want to send to the backend
    const payload = {};
    tr.querySelectorAll('[data-field]').forEach(el => {
      // el.dataset.field gets the value of the data-field attribute
      payload[el.dataset.field] = el.value.trim();
    });
    const res = await fetch(`${API_BASE}/api/techstacks/update/${id}`, {
      method: 'PUT',
      // both POST and PUT requests sending JSON data need this header 'Content-Type':'application/json',
      headers: {
        'Content-Type':'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('jwt')}`
      },
      body: JSON.stringify(payload)
    });
    if (res.status === 401) {
      document.getElementById("loginModal").classList.remove("hidden");
    } else {
      loadTechStacks();
    }

  };

  // click cancel simply reloads the tech stack list
  actionTd.querySelector('[data-action="cancel"]').onclick = () => loadTechStacks();
}

async function loadCategoryOptions() {

  const select = document.getElementById('category');
  // select.innerHTML = '<option value="" disabled selected>Select a category</option>';
  const res = await fetch(`${API_BASE}/api/categories`);
  const cats = await res.json();
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    select.appendChild(opt);
  });

}

// ======================================================
// categories management functions
// ======================================================

async function loadCategories() {
  
  try {
    const res = await fetch(`${API_BASE}/api/categories`, {
      method: 'GET',});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const categories = await res.json();
    // store categories to a global variable for later use
    allCategories = categories;

    const tbody = document.getElementById('category-table-body');
    tbody.innerHTML = '';

    // the idx here is the zero-based index of the current item in the array
    categories.forEach(({ id, name, groupName }, idx) => {
      // tr means table row
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50';
      // this will create a data-id attribute on the <tr> element
      tr.dataset.id = id;   

      // two ways to show the index column
      // use idx+1 for a human-friendly 1-based index, start from 1
      // or use id to display the actual category ID from the database
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
  }
}

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
      const res = await fetch(`${window.API_BASE}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('jwt')}`
        },

        body: JSON.stringify({ name, groupName })
      });

      if (res.status === 401) {
        document.getElementById("loginModal").classList.remove("hidden");
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Error ${res.status}: ${text}`);
      } 

      alert('Category added successfully.');
      inputName.value = '';
      inputGroup.value = '';

      // refresh the category list
      if (typeof loadCategories === 'function') {
        loadCategories();
      }
    } catch (err) {
      console.error('Add category failed:', err);
      alert(`Failed to add category: ${err.message}`);
    }
  });
}

async function editCategory(id) {

  console.log('editCategory invoked, id =', id);
  // find the target table row by data-id
  const tr = document.querySelector(`#category-table-body tr[data-id="${id}"]`);
  if (!tr) return;
  console.log('Found row:', tr);

  // store original values, in case user clicks cancel
  const origName  = tr.cells[1].textContent.trim();
  const origGroup = tr.cells[2].textContent.trim();

  // replace the name and groupName cells with input fields
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

  // replace action buttons with Save/Cancel
  const actionTd = tr.cells[3];
  actionTd.innerHTML = `
    <button data-action="save" class="text-green-600 hover:underline mr-2">Save</button>
    <button data-action="cancel" class="text-red-600 hover:underline">Cancel</button>
  `;

  // handle Save button click
  actionTd.querySelector('[data-action="save"]').onclick = async () => {
    // 收集两个输入框的值
    const payload = {};
    tr.querySelectorAll('input[data-field]').forEach(el => {
      // el.value gets the current value of the input field (HTMLInputElement)
      payload[el.dataset.field] = el.value.trim();
    });

    try {
      const res = await fetch(`${window.API_BASE}/api/categories/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('jwt')}`
        },

        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        if (res.status === 401) {
          document.getElementById("loginModal").classList.remove("hidden");
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      } else {
        // refresh the category list
        loadCategories();
      }
    } catch (err) {
      console.error('Update failed:', err);
      alert(`Update failed: ${err.message}`);
    }
  }

  // go back to original values if user clicks cancel
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
  
  const targetCategoryName = allCategories.find(c => c.id === id)?.name || 'N/A';
  if (!confirm(`Are you sure you want to delete the category "${targetCategoryName}"?`)) return;

  try {
    const res = await fetch(`${API_BASE}/api/categories/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('jwt')}`
      }
    });
    if (res.status === 204) {
      // 删除成功，刷新列表
      loadCategories();
    } else if (res.status === 404) {
      alert('Category not found!');
    } else if (res.status === 401) {
      document.getElementById("loginModal").classList.remove("hidden");
    } else {
      const errMsg = await res.text();
      alert('Delete failed: ' + errMsg);
    }
  } catch (err) {
    console.error('Delete failed:', err);
    alert('Delete failed: ' + err.message);
  }
}

// =================================================
// function to toggle the nav menu on small screens
// =================================================

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

