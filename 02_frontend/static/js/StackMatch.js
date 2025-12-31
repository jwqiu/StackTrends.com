// import { renderTechStackByCompany } from './StackTrends.js';

const API_BASE = window.API_BASE;
let currentJobLevel = "ALL";
let allTechStacks = [];
let selectedStacks = [];
let selectedStacks_companies = [];
let allJobs = []; // 存全部jobs
let jobsPerPage = 20;
let currentPage = 1;
let hasMore = true;
let currentTab = 'jobs';

// when the page loads, the following functions will be executed
document.addEventListener("DOMContentLoaded", () => {
  
  //----------------------------------------
  // initialize tab switching functionality
  //----------------------------------------
  initSwitchTab();

  //----------------------------------------------------------------
  // fetch data used for this page and initialize event listeners
  //----------------------------------------------------------------
  loadJobs();
  loadTechStacks(); // input and add event listeners will be set up inside this function

  //--------------------------------------
  // handle filtering-related functions
  //--------------------------------------
  handleJobLevelClick();
  initApplyCompanyFiltersButton(); 
  initApplyFiltersButton();
  getFilterResultsCount();
  setupRemoveTagListener();

  //--------------------------------------
  // trigger fetch, process and render companies section
  //--------------------------------------
  renderTechStackByCompany();

  //-------------------------------------
  // set up admin login-related functions
  //-------------------------------------
  fetchLoginModal();
  setupAdminLinkClickEvent();

  //--------------------------------
  // helper functions
  //--------------------------------
  setupToggleBtnClickEvent();
  initLoadMoreButton();



});

// ======================================================
// tech stacks selection and management functions
// ======================================================

// when page load, call backend API to get all tech keywords, store in variable allTechStacks
// then, add event listeners to monitor input box changes and button clicks
// so that we can show suggestions matching the input and add selected tech stack to the selected list
async function loadTechStacks() {

  try {
    const response = await fetch(`${API_BASE}/api/keywords/list`);
    allTechStacks = await response.json();
    // if we call a function directly, we must pass in the parameters outselves.
    // but if a function is called by an event listener, the browser will pass in the event object automatically into that function
    // add event listeners here, trigger functions when user types something in the input box or clicks the add button
    document.getElementById("techstack-input").addEventListener("input", showSuggestions);
    document.getElementById("add-btn").addEventListener("click", addSelectedStack);
    document.getElementById("techstack-input-companies-section").addEventListener("input", showSuggestionsCompaniesSection);
    document.getElementById("add-btn-companies-section").addEventListener("click", addSelectedStackCompaniesSection);

  } catch (error) {
    console.error('Error loading tech stacks:', error);
  }
}

// this function will be triggered when user types something in the input box
// when the user is typing, it checks the input value in real time and shows any matching tech-stack keywords in the suggestion list
// cause the event object is passed in automatically by the brower when this function is called by an event listener
// we can access the input value by e.target.value
function showSuggestions(e) {

    const input = e.target.value.trim().toLowerCase();
    const suggestList = document.getElementById("suggest-list");

    if (!input) {
        suggestList.innerHTML = '';
        suggestList.classList.add('hidden');
        return;
    }

    // filter tech keywords matching the input
    const matched = allTechStacks.filter(ts => 
        ts.stackName && ts.stackName.toLowerCase().includes(input) &&
        !selectedStacks.includes(ts.stackName)
    ).slice(0, 5); 
    
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

// we add a click listener here, when the user clicks anywhere on the page, the browser checks whether the clicked target has the remove-btn class
// if does, calling removeTag function below to remove the tag
// because the selected tech stack tags and their remove buttons are generated dynamically after page load
// so we can not attach a click event listener to the remove button directly when the page loads
function setupRemoveTagListener() {

  document.addEventListener('click', function (event) {
    if (event.target.classList.contains('remove-btn')) {
      removeTag(event.target);
    }
  });
}

// if user clicks the remove button on a selected tech stack tag
// remove the element that contains the selected tech stack name and remove it from the selectedStacks array
function removeTag(button) {
  button.parentElement.remove();
  if (currentTab === 'jobs') {
    const name = button.dataset.name;
    const searchBtn = document.querySelector('.apply-filters-btn')
    selectedStacks = selectedStacks.filter(n => n !== name);
    renderSelectedStacks();
    searchBtn.click();
  } else {
    const name = button.dataset.name;
    const searchBtn = document.querySelector('.apply-filters-btn--companies-section')
    selectedStacks_companies = selectedStacks_companies.filter(n => n !== name);
    renderSelectedStacksCompaniesSection();
    searchBtn.click();
  }
}

async function normalizeKeyword(rawKeyword) {

  const url = `${API_BASE}/api/keywords/normalize?keyword=${encodeURIComponent(rawKeyword)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Normalize request failed: ${res.status}`);
  }
  const { normalized } = await res.json();
  return normalized;
}

// this function is triggered when user clicks the add button
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

// there are two ways to trigger this function, when the user clicks the add button to add new tech stack or when user clicks the remvove button to remove a tech stack
// this function is triggered if the selectedStacks array is changed
// a common way to add event listeners to dynamically generated remove button is to attach them after rendering, however, using event delegation is the recommended best practice
function renderSelectedStacks() {
  const container = document.querySelector(".your-tech-stacks");
  container.innerHTML = '';
  if (selectedStacks.length === 0) {
    container.innerHTML = '<p class="text-gray-400 italic">No tech stack selected</p>';
    return;
  }
  selectedStacks.forEach(name => {
      const div = document.createElement('div');
      div.className = "flex items-center bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full";
      div.innerHTML = `
          ${name}
          <button class="remove-btn ml-2 text-blue-600 hover:text-red-500" data-name="${name}">&times;</button>
      `;
      container.appendChild(div);
  });

}

// ======================================================
// filtering and loading jobs data functions
// ======================================================

// when user clicks a job level button, update the currentJobLevel variablen
// then, after the user clicks apply filters button, the loadJobs function will be called to load the filtered jobs data
function handleJobLevelClick() {
  
  document.querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
      currentJobLevel = btn.dataset.filter;
      // currentPage = 1;
      // allJobs = [];

      // update button styles
      document.querySelectorAll('.filter').forEach(b => {
        b.classList.remove('bg-blue-500', 'text-white');
        b.classList.add('bg-gray-200', 'text-gray-700');  
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

// when user clicks the apply filters button, reset currentpage to 1, clear all jobs array
// these two variables will be used in loadJobs function to determine what data to display
function initApplyFiltersButton() {
    document.querySelector('.apply-filters-btn')?.addEventListener('click', async () => {
    currentPage = 1;
    allJobs = [];
    await loadJobs();
    await getFilterResultsCount();
  });
}

async function getFilterResultsCount() {

  let url = `${API_BASE}/api/stats/jobs/count?job_level=${encodeURIComponent(currentJobLevel)}`;

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

}

// this function loads jobs data from the backend API with the current filters and page settings
// the renderJobs function is called after the data is loaded to display the jobs on the page
async function loadJobs() {
  
  let url = `${API_BASE}/api/jobs/list?page=${currentPage}&size=${jobsPerPage}`;
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
  // ... here means unpacking both arrays and appending the new items to the existing array
  allJobs = [...allJobs, ...data.jobs]; 
  hasMore = data.hasMore;
  renderJobs(); // render jobs after loading new data
  if (currentPage === 1) {
    animateJobCards(); // animate only on the first page
  }

}

// ======================================================
// functions to display and render jobs
// ======================================================

// this function will be called after the jobs data is loaded from the backend API
function renderJobs() {

  const jobList = document.getElementById('job-list');
  jobList.innerHTML = ""; // 清空旧内容

  const jobsToShow = allJobs;

  jobsToShow.forEach(job => {

    // get the HTML for the job's tech requirements with highlighted stacks
    const stacks = highlightMatches(job.requiredStacks, selectedStacks);

    const html = `
      <a href="${job.jobUrl}" target="_blank" class="block no-underline text-inherit">
        <div class="${currentPage === 1 ? 'job-card' : ''} p-8 bg-white border border-gray-200 rounded-lg shadow hover:border-blue-500 hover:bg-blue-50 hover:border-2 hover:scale-105 transition-transform duration-300">
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
    // insert the job HTML at the end of the job list container
    jobList.insertAdjacentHTML('beforeend', html);
  });
  // show the load more button if there are more jobs to load, but with a delay of 1 second, to allow the job cards animation to complete first
  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    setTimeout(() => {
      loadMoreBtn.style.display = hasMore ? 'block' : 'none';
    }, 1000);
  }

}

function animateJobCards() {
  const cards = document.querySelectorAll('.job-card');
  cards.forEach((card, index) => {
    setTimeout(() => {
      card.classList.add('animate-fade-up');
    }, index * 350); 
  });
}

// this function requires two parameters as input, stacks is an array of tech keywords required for a job, selected is an array of tech keywords selected by the user
// Javascript doesn't have a List type - its arrays work like dynamic lists
// this function returns the HTML for a job tech requirements
// and hightlights the ones that match the user's selected tech stacks
// to use this code, simply insert it into the container where the job's tech requirements are displayed
function highlightMatches(stacks, selected) {
  
  const clean = stacks
    // s && s.trim() means, s is not null/underfined/empty string, and after trimming, it is still not empty
    // note : this step doesn't actually change the original string, it only checks it
    // so we still need to call trim() again in the next step
    .filter(s => s && s.trim())
    .map(s => s.trim());

  // const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  function capitalize(s){
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  const matched = clean.filter(s => selected.map(x => x.toLowerCase()).includes(s.toLowerCase()));
  const unmatched = clean.filter(s => !selected.map(x => x.toLowerCase()).includes(s.toLowerCase()));
  return [
    ...matched.map(s => `<span class=" bg-blue-500 rounded-lg px-2 py-1 text-white">${capitalize(s)}</span>`),
    ...unmatched.map(s => `<span class=" bg-white rounded-lg px-2 py-1 text-gray-500">${capitalize(s)}</span>`)
  ].join('  ') || 'N/A';
}

// when the page loads, add a click event listener to the load more button
function initLoadMoreButton() {

  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', async() => {
      currentPage++;
      await loadJobs();
    });
  }
}

// ========================================================================
// functions for selecting tech stacks and applying filters in companies section
// ========================================================================

// this function will be triggered when user types something in the input box for companies section, and shows matching suggestions
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
    ).slice(0, 5); // 最多显示10个

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

// this function is triggered when user clicks the add button in the companies section
// it will add the selected tech stack to the selectedStacks_companies array and re-render the selected stacks
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

function renderSelectedStacksCompaniesSection() {

  const container = document.querySelector(".your-tech-stacks-companies-section");
  container.innerHTML = '';
  if (selectedStacks_companies.length === 0) {
    container.innerHTML = '<p class="text-gray-400 italic">No tech stack selected</p>';
    return;
  }
  selectedStacks_companies.forEach(name => {
      const div = document.createElement('div');
      div.className = "flex items-center bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full";
      div.innerHTML = `
          ${name}
          <button class="remove-btn ml-2 text-blue-600 hover:text-red-500" data-name="${name}">&times;</button>
      `;
      container.appendChild(div);
  });
}

// add a click event listener to the apply filters button in the companies section
function initApplyCompanyFiltersButton() {
  document.querySelector('.apply-filters-btn--companies-section')?.addEventListener('click', async () => {
    // 这里假设 allCompaniesData, jobsCountMap 已经提前获取并缓存过
    renderTechStackByCompany();
  });
}

// ========================================================================
// functions to load companies tech stack data and render companies
// ========================================================================

// format a tech skill value into a clean string
function formatSkill(x){
  let skill = "";
  if(typeof x ==='string'){
    skill = x;
  }
  else if(x && x.tech){
    skill = x.tech;
  }
  return skill.toString().trim().toLowerCase();
}

// load all necessary data before rendering companies
// get the tech stack rankings data by company from the backend API
// get the job counts per company from the backend API
async function loadAllCompaniesData() {
  const res  = await fetch(`${window.API_BASE}/api/rankings/by-company`);
  const rows = await res.json();
  const cntRes  = await fetch(`${window.API_BASE}/api/stats/jobs/company`);
  const cntRows = await cntRes.json();

  return {rows, cntRows};
}

// prepare the data used for rendering companies cards in renderTechStackByCompany
function prepareCompanyRenderData(rows, cntRows){

  // const jobsCountMap = cntRows.reduce((m, x) => (m[x.company_Id] = x.jobs_Count, m), {});
  const jobsCountMap = {}
  cntRows.forEach(row=>{
    jobsCountMap[row.company_Id]=row.jobs_Count;
  })

  const byCompany = {};
  // each row in rows is just one company + one category + one technology
  // so the same company will appear multiple times in the rows array
  // the code here just groups them into a tree structure by company and by category
  rows.forEach(r => {

    // the property names here are in camelCase, cause the backend ASP.NET Core automatically converts the PascalCase property names to camelCase in the JSON response
    // when  ASP.NET Core returns JSON responses, it not only converts property names to camelCase, but also normalizes them, like removing underscores
    // correction : however, it seems that ASP.NET Core does not remove underscores from property names automatically
    // this is why we can access r.companyId instead of r.Company_Id(what the backend actually return) here directly
    const cid = r.company_Id; 
    const category = r.category;

    if (!byCompany[cid]) {
      byCompany[cid] = {
        id: cid, 
        name: r.company_Name, 
        cats: {}};
    }

    if(!byCompany[cid].cats[category]){
      byCompany[cid].cats[category] = [];
    }

    byCompany[cid].cats[category].push({
      tech: (r.technology ?? '').trim(),
      percentage: r.percentage ?? r.Percentage ?? 0
    });

  });

  console.log('Selected stacks for filtering companies:', selectedStacks_companies);
  // prepare a unique set of selected stacks for filtering later
  let selectedSet = new Set();
  (selectedStacks_companies || []).forEach(item => {
    const normalized = formatSkill(item);
    if(normalized){
      selectedSet.add(normalized);
    }
  });
  console.log('Selected set for filtering companies:', selectedSet);
  // if there is any selected stack, need to filter companies 
  const shouldFilter = selectedSet.size > 0;

  return {jobsCountMap, byCompany, selectedSet, shouldFilter};
}

function renderCompanyCard(comp, jc){
  const link = document.createElement('a');
  const name = encodeURIComponent(comp.name);
  link.href = `https://www.seek.co.nz/${name}-jobs/at-this-company`;
  link.target = '_blank';
  link.className = 'block';

  const card = document.createElement('div');
  card.className = 'w-full bg-white rounded-lg hover:border-blue-500 hover:bg-blue-50 hover:border-2 hover:scale-105 transition-transform duration-300 shadow-lg flex flex-col gap-y-2 justify-start p-8';
  // the beforeend here means insert this HMTL at the end of the card container
  card.insertAdjacentHTML('beforeend', `
    <div class="flex justify-between items-center">
      <p><span class="text-lg font-bold">${comp.name}</span> – Tech Profile</p>
      <p class="mb-2 text-gray-500">Analysed from <span class="font-mono text-blue-500 font-bold">${jc}</span> Job Postings</p>
    </div>
  `);

  // create a container to hold all categories and their tech stacks
  const gray = document.createElement('div');
  gray.className = 'flex flex-col border gap-y-4 rounded-lg p-4 bg-gray-100';
  
  link.appendChild(card);

  return { link, card, gray };

}

function renderCategoryTags(comp, catLabel, perCategory) {
  // get the top N tech stacks for this category in this company
  const techs = (comp.cats[catLabel] || []).slice(0, perCategory);

  const row = document.createElement('div');
  row.className = 'w-full rounded-lg flex flex-col justify-start  ';

  const nameEl = document.createElement('p');
  nameEl.textContent = catLabel;
  nameEl.className = 'mb-1 text-gray-500 text-sm';
  row.appendChild(nameEl);

  const pills = document.createElement('div');
  pills.className = 'flex  gap-x-2 ';

  return {techs, row, pills};

}

function renderTechSkillsProgressBar(techs, pills, selectedSet,){

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

      // check if this tech stack is in the selected set, if so, highlight it differently
      const isSelected = selectedSet.has(formatSkill(label));
      // TODO : maybe i should convert all tech stack labels to upper case to make it look better
      const cap = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

      // highlight the pill differently if this tech stack is selected
      if (isSelected) {
        // note that we don't show the progress bar for selected tech stacks
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
        bar.className = 'absolute left-0 top-0 h-full bg-gradient-to-r from-gray-400 to-white ';
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

}

// TODO: this function is way too long, need to refactor it into smaller functions to make it easier to read and maintain
// if the entire data, logic, and render flow is simple and short, keeping it inside a single function is totally fine
// but if the function is too long and complex, it should be split according to data, logic and rendering parts for clarity and maintainability
// this function will be triggered when the page loads and when user applies filters in the companies section
async function renderTechStackByCompany( perCategory = 5) {
  
  const{rows, cntRows} = await loadAllCompaniesData();
  const {jobsCountMap, byCompany, selectedSet, shouldFilter} = prepareCompanyRenderData(rows, cntRows);

  const container = document.getElementById("companiesContainer");
  if (!container) return;

  // create a temporary document fragment to hold the generated company cards
  // note that we use a document fragment here instead of creating dom elements directly under the container like div
  // because it lets us build all nodes in memory and append them to the dom in one go
  // which is more efficient and avoids repeated reflows and repaints in the browser, make the rendering faster
  const frag = document.createDocumentFragment();
  const ORDER = ['Frontend', 'Backend', 'Cloud Platforms', 'Database'];
  let renderedAny = false; // ⭐ 标记有没有渲染到公司

  // get all the values (companies) from the byCompany object
  // TODO: split this render loop into smaller functions to make it easier to read and maintain
  Object.values(byCompany)
    // jobsCountMap[b.id] mean the number of jobs for company b
    // sort companies by their job counts in descending order
    .sort((a, b) => (jobsCountMap[b.id] || 0) - (jobsCountMap[a.id] || 0))
    .forEach(comp => {
      if (shouldFilter) {
        // define a helper function to get the label of a tech stack item
        const labelOf = x => (typeof x === 'string' ? x : (x?.tech ?? ''));
        // convert all tech stacks of this company to lower case and trimmed strings
        const norm = x => labelOf(x).trim().toLowerCase();

        const allTechsLower = Object.values(comp.cats)
          .flat()
          .map(norm)
          .filter(Boolean);

        // check if there is at least one selected stack in this company's tech stacks
        const hasAnyMatch = allTechsLower.some(t => selectedSet.has(t));
        if (!hasAnyMatch) return; // 跳过本公司（forEach 的本次迭代）
      }

      renderedAny = true; // 有公司被渲染
      const jc = jobsCountMap[comp.id] || 0;
      const { link, card, gray } = renderCompanyCard(comp, jc);

      ORDER.forEach(catLabel => {
        
        // please note that once a const variable is declared, it can not be re-assigned
        // however, it can still be modified internally
        // this is exactly what I did here, i modified the pills element inside renderCategoryTags function, but didn't return and re-assign it
        const {techs, row, pills} = renderCategoryTags(comp, catLabel, perCategory);
        renderTechSkillsProgressBar(techs, pills, selectedSet);
  
        row.appendChild(pills);
        gray.appendChild(row);
      });

      card.appendChild(gray);
      frag.appendChild(link);
    });

  container.innerHTML = '';
  if (renderedAny) {
    container.appendChild(frag);
  } else {
    // ⭐ 没有匹配公司时提示
    container.innerHTML = '<p class="text-center text-gray-500 p-8 bg-white italic rounded-lg"> 🤷 No matching companies for your selected tech stack</p>';
  }
}

// ========================================================================
// setup tab switching and panel display functions
// ========================================================================

// when the page loads, add click event listeners to the top tab buttons
function initSwitchTab() {
  const sections = ['jobs-section', 'companies-section'];
  const tabBtns = document.querySelectorAll('.tab-btn');

  // 绑定点击
  tabBtns.forEach(btn => {
    // the target used here is a personal data attribute defined in the HTML, which is basically the one of the ids of the two sections
    btn.addEventListener('click', () => showSection(btn.dataset.target));
  });

  // determine which section to show when the page loads based on the URL hash
  const hash = location.hash.replace('#', '');
  if (sections.includes(hash)) {
    showSection(hash);
  } else {
    showSection('jobs-section'); // 默认显示 jobs panel
  }
}

function showSection(id) {

  currentTab = (id === 'jobs-section') ? 'jobs' : 'companies';

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

  // change the URL hash to match the current tab
  // this let the browser remember the tab after a refresh
  if (location.hash !== '#' + id) {
    history.replaceState(null, '', '#' + id);
  }
}

// ========================================================================
// function to toggle the nav menu on small screens
// ========================================================================

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

// ========================================================================
// these two functions below are no longer used, but i keep them here for future reference
// ========================================================================

function openModal() {
  document.getElementById('customModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('customModal').classList.add('hidden');
}
