// const API_BASE = window.API_BASE;
let allTechStacks = [];
let allCategories = [];

document.addEventListener('DOMContentLoaded',  () => {
  enforceLogin(), // check login status first
  loadTechStacks(),
  setupMenu(),
  setupCoverLetterGenerator(),
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
    'menu-stack': 'stack-keyword-panel',
    'menu-cover-letter': 'cover-letter-panel'
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

function setupCoverLetterGenerator() {
  const cvInput = document.getElementById('cover-letter-cv');
  const cvName = document.getElementById('cover-letter-cv-name');
  const cvError = document.getElementById('cover-letter-cv-error');
  const jobSelect = document.getElementById('cover-letter-job');
  const jobStatus = document.getElementById('cover-letter-job-status');
  const listModeButton = document.getElementById('cover-letter-job-mode-list');
  const manualModeButton = document.getElementById('cover-letter-job-mode-manual');
  const listPanel = document.getElementById('cover-letter-job-list-panel');
  const manualPanel = document.getElementById('cover-letter-job-manual-panel');
  const manualTitle = document.getElementById('cover-letter-manual-title');
  const manualDescription = document.getElementById('cover-letter-manual-description');
  const manualDescriptionCount = document.getElementById('cover-letter-manual-description-count');
  const extraPrompt = document.getElementById('cover-letter-extra-prompt');
  const extraPromptCount = document.getElementById('cover-letter-extra-prompt-count');
  const generateButton = document.getElementById('generate-cover-letter');
  const generationStatus = document.getElementById('cover-letter-generation-status');

  if (!cvInput || !cvName || !cvError || !jobSelect || !jobStatus
    || !listModeButton || !manualModeButton || !listPanel || !manualPanel
    || !manualTitle || !manualDescription || !manualDescriptionCount
    || !extraPrompt || !extraPromptCount || !generateButton || !generationStatus) return;

  let jobInputMode = 'list';

  const updateGenerateButton = () => {
    const hasJobDetails = jobInputMode === 'list'
      ? Boolean(jobSelect.value)
      : Boolean(manualTitle.value.trim() && manualDescription.value.trim());
    const isReady = Boolean(cvInput.files?.[0] && hasJobDetails);
    generateButton.disabled = !isReady;
    generateButton.classList.toggle('cursor-not-allowed', !isReady);
    generateButton.classList.toggle('bg-gray-300', !isReady);
    generateButton.classList.toggle('opacity-80', !isReady);
    generateButton.classList.toggle('bg-blue-600', isReady);
    generateButton.classList.toggle('hover:bg-blue-700', isReady);
  };

  const setJobInputMode = mode => {
    jobInputMode = mode;
    const usesList = mode === 'list';

    listPanel.classList.toggle('hidden', !usesList);
    manualPanel.classList.toggle('hidden', usesList);
    listModeButton.setAttribute('aria-pressed', String(usesList));
    manualModeButton.setAttribute('aria-pressed', String(!usesList));

    [listModeButton, manualModeButton].forEach((button, index) => {
      const isActive = usesList ? index === 0 : index === 1;
      button.classList.toggle('bg-white', isActive);
      button.classList.toggle('text-blue-600', isActive);
      button.classList.toggle('shadow-sm', isActive);
      button.classList.toggle('text-gray-500', !isActive);
    });

    updateGenerateButton();
  };

  cvInput.addEventListener('change', () => {
    const file = cvInput.files?.[0];
    cvError.classList.add('hidden');

    if (!file) {
      cvName.textContent = 'No file selected';
      updateGenerateButton();
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'docx') {
      cvInput.value = '';
      cvName.textContent = 'No file selected';
      cvError.textContent = 'Please choose a DOCX file.';
      cvError.classList.remove('hidden');
      updateGenerateButton();
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      cvInput.value = '';
      cvName.textContent = 'No file selected';
      cvError.textContent = 'The CV file must not exceed 5 MB.';
      cvError.classList.remove('hidden');
      updateGenerateButton();
      return;
    }

    cvName.textContent = `${file.name} · ${formatFileSize(file.size)}`;
    updateGenerateButton();
  });

  listModeButton.addEventListener('click', () => setJobInputMode('list'));
  manualModeButton.addEventListener('click', () => setJobInputMode('manual'));
  jobSelect.addEventListener('change', updateGenerateButton);
  manualTitle.addEventListener('input', updateGenerateButton);
  manualDescription.addEventListener('input', () => {
    manualDescriptionCount.textContent = `${manualDescription.value.length} / 30000`;
    updateGenerateButton();
  });
  extraPrompt.addEventListener('input', () => {
    extraPromptCount.textContent = `${extraPrompt.value.length} / 2000`;
  });

  generateButton.addEventListener('click', async () => {
    const cv = cvInput.files?.[0];
    const usesMatchedJob = jobInputMode === 'list';
    const jobId = usesMatchedJob ? jobSelect.value : '';
    const pastedTitle = usesMatchedJob ? '' : manualTitle.value.trim();
    const pastedDescription = usesMatchedJob ? '' : manualDescription.value.trim();
    if (!cv || (usesMatchedJob ? !jobId : !pastedTitle || !pastedDescription)) return;

    generateButton.disabled = true;
    generateButton.classList.add('cursor-not-allowed', 'bg-gray-300', 'opacity-80');
    generateButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    generationStatus.textContent = 'Crafting your tailored cover letter — this may take a moment...';
    generationStatus.className = 'mt-3 text-center text-xs text-gray-500';

    try {
      const formData = new FormData();
      formData.append('cv', cv);
      if (usesMatchedJob) {
        formData.append('jobId', jobId);
      } else {
        formData.append('jobTitle', pastedTitle);
        formData.append('jobDescription', pastedDescription);
      }
      if (extraPrompt.value.trim()) {
        formData.append('extraPrompt', extraPrompt.value.trim());
      }

      const response = await fetch(`${window.API_BASE}/api/cover-letter/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('jwt')}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || `Generation failed (${response.status}).`);
      }

      const documentBlob = await response.blob();
      const downloadUrl = URL.createObjectURL(documentBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = getDownloadFileName(
        response.headers.get('Content-Disposition'),
        usesMatchedJob
          ? jobSelect.options[jobSelect.selectedIndex]?.textContent
          : pastedTitle
      );
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

      generationStatus.textContent = '';
      generationStatus.className = 'hidden';
      cvInput.value = '';
      cvName.textContent = 'No file selected';
      cvError.textContent = '';
      cvError.classList.add('hidden');
      jobSelect.value = '';
      manualTitle.value = '';
      manualDescription.value = '';
      manualDescriptionCount.textContent = '0 / 30000';
      extraPrompt.value = '';
      extraPromptCount.textContent = '0 / 2000';
      setJobInputMode('list');
    } catch (error) {
      generationStatus.textContent = error.message || 'Unable to generate the cover letter.';
      generationStatus.className = 'mt-3 text-center text-xs text-red-500';
    } finally {
      updateGenerateButton();
    }
  });

  loadCoverLetterJobs(jobSelect, jobStatus, updateGenerateButton);
}

async function loadCoverLetterJobs(jobSelect, jobStatus, updateGenerateButton) {
  try {
    const response = await fetch(`${window.API_BASE}/api/cover-letter/jobs`, {
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem('jwt')}`
      }
    });

    if (!response.ok) throw new Error(`Unable to load jobs (${response.status}).`);

    const jobs = await response.json();
    jobSelect.innerHTML = '<option value="">Select a job</option>';

    jobs.forEach(job => {
      const option = document.createElement('option');
      option.value = job.jobId;
      option.textContent = `${job.jobTitle} — ${job.companyName || 'Unknown company'}`;
      jobSelect.appendChild(option);
    });

    jobSelect.disabled = false;
    jobStatus.textContent = `${jobs.length} matched job${jobs.length === 1 ? '' : 's'} available.`;
    jobStatus.className = 'mt-2 text-xs text-gray-400';
    updateGenerateButton();
  } catch (error) {
    jobSelect.innerHTML = '<option value="">Unable to load jobs</option>';
    jobStatus.textContent = error.message || 'Unable to load matched jobs.';
    jobStatus.className = 'mt-2 text-xs text-red-500';
  }
}

function getDownloadFileName(contentDisposition, selectedJobLabel) {
  if (contentDisposition) {
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match) return decodeURIComponent(utf8Match[1]);

    const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (fileNameMatch) return fileNameMatch[1];
  }

  const fallbackName = (selectedJobLabel || 'Cover Letter')
    .replace(/[^a-z0-9 _-]/gi, '_')
    .trim();
  return `${fallbackName || 'Cover Letter'}.docx`;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
        const res = await fetch(`${API_BASE}/api/keywords/list`);
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
  const res = await fetch(`${API_BASE}/api/keywords/add`, {
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
    const res = await fetch(`${API_BASE}/api/keywords/delete/${id}`, {
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
    const res = await fetch(`${API_BASE}/api/keywords/update/${id}`, {
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
