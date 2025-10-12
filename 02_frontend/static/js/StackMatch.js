// import { renderTechStackByCompany } from './StackTrends.js';

const API_BASE = window.API_BASE;
let currentJobLevel = "ALL";
let allTechStacks = [];
let selectedStacks = [];
let selectedStacks_companies = [];



function removeTag(button) {
    button.parentElement.remove();
  }

  // Event listener for remove buttons
document.addEventListener('click', function (event) {
    if (event.target.classList.contains('remove-btn')) {
      removeTag(event.target);
    }
  });
  

document.addEventListener("DOMContentLoaded", () => {
    loadJobs();
    loadMoreJobs();
    loadTechStacks();
    filterJobsByLevel();
    applyFilters();
    getFilterResultsCount();
    switchTab();
    applyCompanyFilters(); 
    renderTechStackByCompany('companiesContainer', `${window.API_BASE}/api/companies/tech-stack-rank`, 5, []);


});


// function highlightMatchingStacks(){
//   // Step 1: Get the selected tech stacks
//   const selectedStacks = Array.from(
//       document.querySelectorAll(".your-tech-stacks .flex.items-center")
//   ).map((stack) => stack.childNodes[0].nodeValue.trim().toLowerCase()); // Get only the text (excluding the button)

//   // Step 2: Find all "Required Tech Stacks" elements
//   const requiredStacksElements = document.querySelectorAll(
//       ".required-tech-stacks"
//   );

//   requiredStacksElements.forEach((element) => {
//       // Extract only the tech stacks (ignore the "Required Tech Stacks:" label)
//       const stacksText = element.textContent.replace("Required Tech Stacks:", "").trim();
//       const stacks = stacksText.split(",").map((stack) => stack.trim().toLowerCase());

//       const matchingStacks = stacks.filter((stack) => selectedStacks.includes(stack));
//       const nonMatchingStacks = stacks.filter((stack) => !selectedStacks.includes(stack));

//       element.innerHTML = `<strong>Required Tech Stacks: </strong><span class="text-red-600">${matchingStacks.join(", ")}</span>, ${nonMatchingStacks.join(", ")}`;
//   });
// }

let allJobs = []; // 存全部jobs
let jobsPerPage = 20;
let currentPage = 1;
let hasMore = true;

async function normalizeKeyword(rawKeyword) {
  const url = `${API_BASE}/api/TechStack/normalize?keyword=${encodeURIComponent(rawKeyword)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Normalize request failed: ${res.status}`);
  }
  const { normalized } = await res.json();
  return normalized;
}

async function loadJobs() {
  // 调用后端API获取所有职位
  let url = `${API_BASE}/api/job/all?page=${currentPage}&size=${jobsPerPage}`;
  if (currentJobLevel && currentJobLevel.toLowerCase() !== 'all') {
    url += `&job_level=${encodeURIComponent(currentJobLevel)}`;
  }
  if (selectedStacks.length > 0) {
    for (const kw of selectedStacks) {
      if (kw.trim()) {
        url += `&keywords=${encodeURIComponent(kw)}`;
      }
    }
    console.log("Requesting jobs with URL:", url);
  }
  const response = await fetch(url);
  const data = await response.json();
  allJobs = [...allJobs, ...data.jobs]; 
  hasMore = data.hasMore;
  renderJobs(); // 渲染第一页

}

function highlightStacksHtml(stacks, selected) {
  const clean = stacks
    .filter(s => s && s.trim())
    .map(s => s.trim());

  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const matched = clean.filter(s => selected.includes(s.toLowerCase()));
  const unmatched = clean.filter(s => !selected.includes(s.toLowerCase()));
  return [
    ...matched.map(s => `<span class=" bg-blue-500 rounded-lg px-2 py-1 text-white">${capitalize(s)}</span>`),
    ...unmatched.map(s => `<span class=" bg-white rounded-lg px-2 py-1 text-gray-500">${capitalize(s)}</span>`)
  ].join('  ') || 'N/A';
}


function renderJobs() {
  const jobList = document.getElementById('job-list');
  jobList.innerHTML = ""; // 清空旧内容

  // const jobsToShow = allJobs.slice(0, currentPage * jobsPerPage);
  const jobsToShow = allJobs;

  jobsToShow.forEach(job => {
    // 拼接 required stacks
    // const stacks = job.requiredStacks && job.requiredStacks.length > 0
    // ? job.requiredStacks.filter(s => s && s.trim() !== '').join(', ') || 'N/A'
    // : 'N/A';
    const stacks = highlightStacksHtml(job.requiredStacks, selectedStacks);
    // 可自定义图片路径和其它字段
    const html = `
      <a href="${job.jobUrl}" target="_blank" class="block no-underline text-inherit">
        <div class="p-8 bg-white border border-gray-200 rounded-lg shadow hover:border-blue-500 hover:bg-blue-50 hover:border-2 hover:scale-105 transition-transform duration-300">
          <h3 class="font-bold text-lg text-grey-700">${job.jobTitle}</h3>
          <p class="text-sm text-gray-600 mt-1 ">
            ${job.companyName ?? 'N/A'} 
          </p>
          <div class="flex justify-between items-center  mt-1">
            <div>
              <p class="text-sm text-gray-600 mt-1 mt-1 ">
                📍 ${job.jobLocation ?? 'N/A'}
              </p>
            </div>
            <div>
              <p class="text-sm text-gray-600 ">
                Posted on 🗓️ ${job.listedDate 
                ? new Date(job.listedDate).toLocaleDateString('en-NZ') 
                : 'N/A'}
              </p>
            </div>

          </div>
          <div class="mt-4 bg-gray-100 p-4 rounded shadow-md">
            <p class="inline-flex items-center text-sm text-gray-500 gap-1 mt-0">
                 Tech Requirements:
            </p>
            <p class="required-tech-stacks font-mono flex flex-wrap gap-2 text-sm mt-2">
              ${stacks}
            </p>
          </div>
        </div>
      </a>
    `;
    jobList.insertAdjacentHTML('beforeend', html);
  });
  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.style.display = hasMore ? 'block' : 'none';
  }

}

function applyFilters() {
    document.querySelector('.apply-filters-btn')?.addEventListener('click', async () => {
    currentPage = 1;
    allJobs = [];
    await loadJobs();
    await getFilterResultsCount();
  });
}

function loadMoreJobs() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', async() => {
        currentPage++;
        await loadJobs();
      });
    }
}



async function loadTechStacks() {
  // 调用后端API获取所有技术栈
  try {
    const response = await fetch(`${API_BASE}/api/TechStack/all`);
    allTechStacks = await response.json();
    document.getElementById("techstack-input").addEventListener("input", showSuggestions);
    document.getElementById("add-btn").addEventListener("click", addSelectedStack);
    document.getElementById("techstack-input-companies-section").addEventListener("input", showSuggestionsCompaniesSection);
    document.getElementById("add-btn-companies-section").addEventListener("click", addSelectedStackCompaniesSection);

  } catch (error) {
    console.error('Error loading tech stacks:', error);
  }
}



function showSuggestions(e) {
    const input = e.target.value.trim().toLowerCase();
    const suggestList = document.getElementById("suggest-list");

    if (!input) {
        suggestList.innerHTML = '';
        suggestList.classList.add('hidden');
        return;
    }

    // 模糊查找 tech stack 名
    const matched = allTechStacks.filter(ts => 
        ts.stackName && ts.stackName.toLowerCase().includes(input) &&
        !selectedStacks.includes(ts.stackName)
    ).slice(0, 10); // 最多显示10个

    if (matched.length === 0) {
        suggestList.innerHTML = '<li class="px-4 py-2 text-gray-400">No match</li>';
    } else {
        suggestList.innerHTML = matched.map(ts =>
            `<li class="px-4 py-2 hover:bg-blue-100 cursor-pointer" data-name="${ts.stackName}">${ts.stackName}</li>`
        ).join('');
    }
    suggestList.classList.remove('hidden');

    // 点击候选项自动填充
    suggestList.querySelectorAll('li[data-name]').forEach(li => {
        li.addEventListener('click', () => {
            document.getElementById("techstack-input").value = li.dataset.name;
            suggestList.innerHTML = '';
            suggestList.classList.add('hidden');
        });
    });
}

function showSuggestionsCompaniesSection(e) {
    const input = e.target.value.trim().toLowerCase();
    const suggestList = document.getElementById("suggest-list-companies-section");

    if (!input) {
        suggestList.innerHTML = '';
        suggestList.classList.add('hidden');
        return;
    }

    // 模糊查找 tech stack 名
    const matched = allTechStacks.filter(ts => 
        ts.stackName && ts.stackName.toLowerCase().includes(input) &&
        !selectedStacks_companies.includes(ts.stackName)
    ).slice(0, 10); // 最多显示10个

    if (matched.length === 0) {
        suggestList.innerHTML = '<li class="px-4 py-2 text-gray-400">No match</li>';
    } else {
        suggestList.innerHTML = matched.map(ts =>
            `<li class="px-4 py-2 hover:bg-blue-100 cursor-pointer" data-name="${ts.stackName}">${ts.stackName}</li>`
        ).join('');
    }
    suggestList.classList.remove('hidden');

    // 点击候选项自动填充
    suggestList.querySelectorAll('li[data-name]').forEach(li => {
        li.addEventListener('click', () => {
            document.getElementById("techstack-input-companies-section").value = li.dataset.name;
            suggestList.innerHTML = '';
            suggestList.classList.add('hidden');
        });
    });
}

async function addSelectedStack() {
    const input = document.getElementById("techstack-input");
    const raw = input.value.trim();
    if (!raw) return;
    console.log(`Raw value is: ${raw}`);

    let norm = await normalizeKeyword(raw);
    if (!norm) norm = raw;
    console.log(`Normalized value is: ${norm}`);

    // 避免重复
    if (!selectedStacks.includes(norm)) {
        selectedStacks.push(norm);
        renderSelectedStacks();
        console.log(`Added tech stack: ${norm}`);
        console.log(`Current selected stacks: ${selectedStacks.join(', ')}`);
    }
    input.value = '';
    document.getElementById("suggest-list").innerHTML = '';
    document.getElementById("suggest-list").classList.add('hidden');
}

async function addSelectedStackCompaniesSection() {
    const input = document.getElementById("techstack-input-companies-section");
    const raw = input.value.trim();
    if (!raw) return;
    console.log(`Raw value is: ${raw}`);

    let norm = await normalizeKeyword(raw);
    if (!norm) norm = raw;
    console.log(`Normalized value is: ${norm}`);

    // 避免重复
    if (!selectedStacks_companies.includes(norm)) {
        selectedStacks_companies.push(norm);
        renderSelectedStacksCompaniesSection();
        console.log(`Added tech stack: ${norm}`);
        console.log(`Current selected stacks: ${selectedStacks_companies.join(', ')}`);
    }
    input.value = '';
    document.getElementById("suggest-list-companies-section").innerHTML = '';
    document.getElementById("suggest-list-companies-section").classList.add('hidden');
}

// 渲染已选 tech stack 区
function renderSelectedStacks() {
    const container = document.querySelector(".your-tech-stacks");
    container.innerHTML = '';
    selectedStacks.forEach(name => {
        const div = document.createElement('div');
        div.className = "flex items-center bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full";
        div.innerHTML = `
            ${name}
            <button class="remove-btn ml-2 text-blue-600 hover:text-red-500" data-name="${name}">&times;</button>
        `;
        container.appendChild(div);
    });
    // 绑定移除按钮
    container.querySelectorAll(".remove-btn").forEach(btn => {
        btn.onclick = async function() {
            selectedStacks = selectedStacks.filter(n => n !== btn.dataset.name);
            renderSelectedStacks();

            currentPage = 1;
            allJobs = [];
            await loadJobs();
            await getFilterResultsCount();
        };
    });
    // highlightMatchingStacks();

}

// 渲染已选 tech stack 区
function renderSelectedStacksCompaniesSection() {
    const container = document.querySelector(".your-tech-stacks-companies-section");
    container.innerHTML = '';
    selectedStacks_companies.forEach(name => {
        const div = document.createElement('div');
        div.className = "flex items-center bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full";
        div.innerHTML = `
            ${name}
            <button class="remove-btn ml-2 text-blue-600 hover:text-red-500" data-name="${name}">&times;</button>
        `;
        container.appendChild(div);
    });
    // 绑定移除按钮
    container.querySelectorAll(".remove-btn").forEach(btn => {
        btn.onclick = function() {
            selectedStacks_companies = selectedStacks_companies.filter(n => n !== btn.dataset.name);
            renderSelectedStacksCompaniesSection();

            // ⬇️ 手动触发公司筛选
            renderTechStackByCompany(
              'companiesContainer',
              `${window.API_BASE}/api/companies/tech-stack-rank`,
              5,
              selectedStacks_companies
            );
        };
    });
    // highlightMatchingStacks();

}


function filterJobsByLevel() {
  
  document.querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
      currentJobLevel = btn.dataset.filter;
      currentPage = 1;
      allJobs = [];
      // ✅ 先清除所有按钮的高亮状态
      document.querySelectorAll('.filter').forEach(b => {
        b.classList.remove('bg-blue-500', 'text-white');
        b.classList.add('bg-gray-200', 'text-gray-700');  // 你原来写的是 text-gray-300
      });

      // ✅ 给当前点击按钮加高亮样式
      btn.classList.remove('bg-gray-200', 'text-gray-700');
      btn.classList.add('bg-blue-500', 'text-white');

      // await loadJobs();
    });
  });

  const defaultBtn = document.querySelector('.filter[data-filter="ALL"]');
  if (defaultBtn) defaultBtn.click();

}



async function getFilterResultsCount() {
  let url = `${API_BASE}/api/Job/count?job_level=${encodeURIComponent(currentJobLevel)}`;

  if (selectedStacks.length > 0) {
    for (const kw of selectedStacks) {
      if (kw.trim()) {
        url += `&keywords=${encodeURIComponent(kw)}`;
      }
    }
    console.log("Requesting jobs with URL:", url);
  }
  const response = await fetch(url);
  const { count } = await response.json();
  const countDisplay = document.getElementById('results-count');
  countDisplay.textContent = count;
  countDisplay.parentElement.style.display = 'block';
  // const response = await fetch(`https://localhost:5001/api/Job/count?job_level=${currentJobLevel}`);
  // const data = await response.json();
  // const count = data.count;
  // const countDisplay = document.getElementById('results-count');
  // countDisplay.textContent = `${count}`;
  // countDisplay.parentElement.style.display = 'block';
}

document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("menu-toggle");
  const menu = document.getElementById("menu");

  toggleBtn.addEventListener("click", () => {
    menu.classList.toggle("hidden");
  });
});

function openModal() {
  document.getElementById('customModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('customModal').classList.add('hidden');
}

function showSection(id) {
  const sections = ['jobs-section', 'companies-section'];
  const tabBtns = document.querySelectorAll('.tab-btn');

  // 切 panel
  sections.forEach(secId => {
    const el = document.getElementById(secId);
    if (!el) return;
    if (secId === id) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });

  // 切 tab 样式 & aria
  tabBtns.forEach(btn => {
    let active
    if (btn.dataset.target === id) {
      active = true;
    } else {
      active = false;
    }

    if (active) {
      btn.setAttribute('aria-selected', 'true');
      btn.classList.add('text-blue-600');
      btn.classList.remove('text-gray-400','text-md');

    } else {
      btn.setAttribute('aria-selected', 'false');
      btn.classList.add('text-gray-400','text-md');
      btn.classList.remove('text-blue-600');
    }

    const icon = btn.querySelector('.selected-icon');

    if (icon) {
      icon.classList.toggle('hidden', !active);
      icon.classList.toggle('block', active);
    }

  });

  // 可选：同步 URL hash，刷新后还能保持当前 tab
  if (location.hash !== '#' + id) {
    history.replaceState(null, '', '#' + id);
  }
}

function switchTab() {
  const sections = ['jobs-section', 'companies-section'];
  const tabBtns = document.querySelectorAll('.tab-btn');

  // 绑定点击
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => showSection(btn.dataset.target));
  });

  // 初始：根据 URL hash 或默认显示 jobs
  const initial = location.hash?.slice(1);
  showSection(sections.includes(initial) ? initial : 'jobs-section');
}


// 渲染成「Tech Profile 卡片（胶囊标签版）」。
// 用法：renderCompanyTechProfiles('companies-container', `${window.API_BASE}/api/companies/tech-stack`)
// async function renderTechStackByCompany(containerId, apiUrl, perCategory = 5) {
//   // 1) 拉数据
//   const res  = await fetch(apiUrl);
//   const rows = await res.json();

//   const cntRes  = await fetch(`${window.API_BASE}/api/companies/jobs-count`);
//   const cntRows = await cntRes.json();
//   const jobsCountMap = cntRows.reduce((m, x) => (m[x.company_Id] = x.jobs_Count, m), {});

//   // 2) 按公司聚合：{ id, name, cats: {Frontend:[], Backend:[], ...} }
//   const byCompany = {};
//   rows.forEach(r => {
//     const cid = r.company_Id;
//     byCompany[cid] ??= { id: cid, name: r.company_Name, cats: {} };
//     const cats = byCompany[cid].cats;

//     (cats[r.category] ??= []).push(
//       (r.technology ?? '').trim()
//     );
//   });

//   // 3) 写入 DOM
//   const container = document.getElementById(containerId);
//   if (!container) {
//     console.warn('Container not found:', containerId);
//     return;
//   }

//   const frag = document.createDocumentFragment();
//   const ORDER = ['Frontend', 'Backend', 'Cloud Platforms', 'Database']; // 显示顺序（注意“Cloud Platform”单数）

//   Object
//     .values(byCompany)
//     // 先按职位数降序
//     .sort((a, b) => (jobsCountMap[b.id] || 0) - (jobsCountMap[a.id] || 0))
//     .forEach(comp => {
//       const jc = jobsCountMap[comp.id] || 0;

//       // 外层卡片
//       const card = document.createElement('div');
//       card.className = 'w-full bg-white rounded-lg shadow-lg flex flex-col gap-y-2 justify-start p-8';

//       // 顶部标题行
//       card.insertAdjacentHTML('beforeend', `
//         <div class="flex justify-between items-center">
//           <p><span class="text-lg font-bold">${comp.name}</span> – Tech Profile</p>
//           <p class="mb-2 text-gray-500">Analysed from ${jc} Job Postings</p>
//         </div>
//       `);

//       // 灰底区域
//       const gray = document.createElement('div');
//       gray.className = 'flex flex-col border gap-y-4 rounded-lg p-4 bg-gray-100';

//       ORDER.forEach(catLabel => {
//         const techs = (comp.cats[catLabel] || []).slice(0, perCategory); // 每类最多 N 个
//         // 行容器
//         const row = document.createElement('div');
//         row.className = 'w-full rounded-lg flex justify-start items-center px-4';

//         // 左侧分类名
//         const nameEl = document.createElement('p');
//         nameEl.textContent = catLabel;
//         row.appendChild(nameEl);

//         // 右侧胶囊区
//         const pills = document.createElement('div');
//         pills.className = 'flex gap-x-2 ms-4';

//         techs.forEach(t => {
//           const pill = document.createElement('p');
//           pill.className = 'px-3 py-1 bg-white rounded-lg';
//           pill.textContent = t;
//           pills.appendChild(pill);
//         });

//         row.appendChild(pills);
//         gray.appendChild(row);
//       });

//       card.appendChild(gray);
//       frag.appendChild(card);
//     });

//   container.innerHTML = '';      // 可选：先清空
//   container.appendChild(frag);
// }

// async function renderTechStackByCompany(containerId, apiUrl, perCategory = 5, selectedStacks) {
//   // 1) 拉数据
//   const res  = await fetch(apiUrl);
//   const rows = await res.json();

//   const cntRes  = await fetch(`${window.API_BASE}/api/companies/jobs-count`);
//   const cntRows = await cntRes.json();
//   const jobsCountMap = cntRows.reduce((m, x) => (m[x.company_Id] = x.jobs_Count, m), {});

//   // 2) 按公司聚合
//   const byCompany = {};
//   rows.forEach(r => {
//     const cid = r.company_Id;
//     byCompany[cid] ??= { id: cid, name: r.company_Name, cats: {} };
//     (byCompany[cid].cats[r.category] ??= []).push((r.technology ?? '').trim());
//   });

//   // 3) 渲染
//   const container = document.getElementById(containerId);
//   if (!container) return;

//   const frag = document.createDocumentFragment();
//   const ORDER = ['Frontend', 'Backend', 'Cloud Platforms', 'Database'];

//   Object.values(byCompany)
//     .sort((a, b) => (jobsCountMap[b.id] || 0) - (jobsCountMap[a.id] || 0))
//     .forEach(comp => {
//       const jc = jobsCountMap[comp.id] || 0;

//       const card = document.createElement('div');
//       card.className = 'w-full bg-white rounded-lg shadow-lg flex flex-col gap-y-2 justify-start p-8';

//       card.insertAdjacentHTML('beforeend', `
//         <div class="flex justify-between items-center">
//           <p><span class="text-lg font-bold">${comp.name}</span> – Tech Profile</p>
//           <p class="mb-2 text-gray-500">Analysed from ${jc} Job Postings</p>
//         </div>
//       `);

//       const gray = document.createElement('div');
//       gray.className = 'flex flex-col border gap-y-4 rounded-lg p-4 bg-gray-100';

//       ORDER.forEach(catLabel => {
//         const techs = (comp.cats[catLabel] || []).slice(0, perCategory);

//         const row = document.createElement('div');
//         row.className = 'w-full rounded-lg flex justify-start items-center px-4';

//         const nameEl = document.createElement('p');
//         nameEl.textContent = catLabel;
//         row.appendChild(nameEl);

//         const pills = document.createElement('div');
//         pills.className = 'flex gap-x-2 ms-4';

//         techs.forEach(t => {
//           if (!t) return;
//           const pill = document.createElement('p');

//           // 🔹 高亮逻辑：selectedStacks 里有的就蓝底白字，否则白底灰字
//           const isSelected = selectedStacks.includes(t.toLowerCase());
//           pill.className = isSelected
//             ? 'px-3 py-1 bg-blue-400 text-white rounded-lg'
//             : 'px-3 py-1 bg-white text-gray-700 rounded-lg';

//           pill.textContent = t;
//           pills.appendChild(pill);
//         });

//         row.appendChild(pills);
//         gray.appendChild(row);
//       });

//       card.appendChild(gray);
//       frag.appendChild(card);
//     });

//   container.innerHTML = '';
//   container.appendChild(frag);
// }

async function renderTechStackByCompany(containerId, apiUrl, perCategory = 5, selectedStacks_companies = []) {
  // 1) 拉数据
  const res  = await fetch(apiUrl);
  const rows = await res.json();

  const cntRes  = await fetch(`${window.API_BASE}/api/companies/jobs-count`);
  const cntRows = await cntRes.json();
  const jobsCountMap = cntRows.reduce((m, x) => (m[x.company_Id] = x.jobs_Count, m), {});

  // 2) 按公司聚合
  // const byCompany = {};
  // rows.forEach(r => {
  //   const cid = r.company_Id;
  //   byCompany[cid] ??= { id: cid, name: r.company_Name, cats: {} };
  //   (byCompany[cid].cats[r.category] ??= []).push((r.technology ?? '').trim());
  // });
  const byCompany = {};
  rows.forEach(r => {
    const cid = r.company_Id;
    byCompany[cid] ??= { id: cid, name: r.company_Name, cats: {} };
    (byCompany[cid].cats[r.category] ??= []).push({
      tech: (r.technology ?? '').trim(),
      percentage: r.percentage ?? r.Percentage ?? 0
    });
  });

  // ⭐ 归一化所选技能，准备过滤
  // const norm = s => (s ?? '').toString().trim().toLowerCase();
  const norm = x =>
  (typeof x === 'string' ? x : (x?.tech ?? ''))
    .toString()
    .trim()
    .toLowerCase();
  const selectedSet = new Set((selectedStacks_companies || []).map(norm).filter(Boolean));
  const shouldFilter = selectedSet.size > 0;

  // 3) 渲染
  const container = document.getElementById(containerId);
  if (!container) return;

  const frag = document.createDocumentFragment();
  const ORDER = ['Frontend', 'Backend', 'Cloud Platforms', 'Database'];

  let renderedAny = false; // ⭐ 标记有没有渲染到公司

  Object.values(byCompany)
    .sort((a, b) => (jobsCountMap[b.id] || 0) - (jobsCountMap[a.id] || 0))
    .forEach(comp => {
      // ⭐ 若需要过滤，先用“公司完整技术列表”判断是否有任一匹配
      if (shouldFilter) {
        // 统一取出技术名；兼容字符串或 {tech, percentage}
        const labelOf = x => (typeof x === 'string' ? x : (x?.tech ?? ''));
        // 统一小写化
        const norm = x => labelOf(x).trim().toLowerCase();

        const allTechsLower = Object.values(comp.cats)
          .flat()
          .map(norm)
          .filter(Boolean);

        const hasAnyMatch = allTechsLower.some(t => selectedSet.has(t));
        if (!hasAnyMatch) return; // 跳过本公司（forEach 的本次迭代）
      }

      renderedAny = true; // 有公司被渲染

      const jc = jobsCountMap[comp.id] || 0;

      const card = document.createElement('div');
      card.className = 'w-full bg-white rounded-lg hover:border-blue-500 hover:bg-blue-50 hover:border-2 hover:scale-105 transition-transform duration-300 shadow-lg flex flex-col gap-y-2 justify-start p-8';

      card.insertAdjacentHTML('beforeend', `
        <div class="flex justify-between items-center">
          <p><span class="text-lg font-bold">${comp.name}</span> – Tech Profile</p>
          <p class="mb-2 text-gray-500">Analysed from ${jc} Job Postings</p>
        </div>
      `);

      const gray = document.createElement('div');
      gray.className = 'flex flex-col border gap-y-4 rounded-lg p-4 bg-gray-100';

      ORDER.forEach(catLabel => {
        const techs = (comp.cats[catLabel] || []).slice(0, perCategory);

        const row = document.createElement('div');
        row.className = 'w-full rounded-lg flex flex-col justify-start  ';

        const nameEl = document.createElement('p');
        nameEl.textContent = catLabel;
        nameEl.className = 'mb-1 text-gray-500 text-sm';
        row.appendChild(nameEl);

        const pills = document.createElement('div');
        pills.className = 'flex  gap-x-2 ';

        if (techs.length === 0) {
          // ⭐ 如果该类没有任何技术栈
          const noneEl = document.createElement('p');
          noneEl.className = 'text-gray-400 italic';
          noneEl.textContent = 'Not specified in job postings';
          pills.appendChild(noneEl);
        } else {

          techs.forEach(t => {
            if (!t) return;
            const pill = document.createElement('p');
            const label = typeof t === 'string' ? t : (t?.tech ?? '');
                   
            // 高亮：selectedStacks 命中的蓝底白字
            // const isSelected = selectedSet.has(norm(t));


            const isSelected = selectedSet.has(norm(label));
            const cap = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

            if (isSelected) {
              pill.className = 'px-3 py-1 bg-blue-500 text-white rounded-lg relative overflow-hidden';
              const text = document.createElement('span');
              text.textContent = cap(label);
              pill.appendChild(text);

            } else {
              pill.className = 'px-3 py-1 bg-white text-gray-700 rounded-lg relative overflow-hidden';
              // ⬇️ ② 计算百分比（兼容 0–1 / 0–100）
              const pct = (t.percentage <= 1 ? t.percentage * 100 : t.percentage) || 0;

              // ⬇️ ③ 插入进度条（仅背景条，样式参考你的示例）
              const bar = document.createElement('span');
              bar.className = 'absolute left-0 top-0 h-full bg-gradient-to-r from-gray-300 to-gray-100';
              bar.style.width = pct.toFixed(1) + '%';
              pill.appendChild(bar);

              // ⬇️ ④ 保持原有文字渲染（会在进度条之上）
              const text = document.createElement('span');
              text.className = 'relative z-10 text-gray-500 text-sm inline-block w-full text-right px-2 whitespace-nowrap';
              text.textContent = cap(label);
              pill.appendChild(text);
            }

            // const cap = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
   
            pills.appendChild(pill);
          });
        } 
        row.appendChild(pills);
        gray.appendChild(row);
      });

      card.appendChild(gray);
      frag.appendChild(card);
    });

  container.innerHTML = '';
  if (renderedAny) {
    container.appendChild(frag);
  } else {
    // ⭐ 没有匹配公司时提示
    container.innerHTML = '<p class="text-center text-gray-500 p-8 bg-white italic rounded-lg"> 🤷 No matching companies for your selected tech stack</p>';
  }
}


function applyCompanyFilters() {
  document.querySelector('.apply-filters-btn--companies-section')?.addEventListener('click', async () => {
    // 这里假设 allCompaniesData, jobsCountMap 已经提前获取并缓存过
    renderTechStackByCompany('companiesContainer', `${window.API_BASE}/api/companies/tech-stack-rank`, 5, selectedStacks_companies);
  });
}
