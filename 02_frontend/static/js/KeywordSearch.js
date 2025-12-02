// const API_BASE = window.API_BASE;

let matchedJobs = [];
let displayCount = 0;
const PAGE_SIZE = 20;

document.addEventListener('DOMContentLoaded', () => {
  // add listener to the search button first;
  // so the header will be updated when user enters keyword and clicks search  
  renderKeywordHeader();
  // manually set initial keyword and trigger search after page load
  initialFirstKeyword();
  setupToggleBtnClickEvent();
  fetchLoginModal();
  setupAdminLinkClickEvent();
});

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

// ============================================================================
// function to initialize a first keyword and trigger search when page loads
// ============================================================================

// document.getElementById("idName") is used to get the element with specific ID, can only get one element
// document.getElementsByClassName("className") is used to get all elements with specific class name, can get multiple elements
// document.getElementsByTagName("div") is used to get all elements with specific tag name, like div, p, etc., can get multiple elements
// document.querySelector("") is used to get the first element that matches a specific CSS selector
// document.querySelectorAll("") is used to get all elements that match a specific CSS selector
// In modern frontend development, querySelector and querySelectorAll are the most commonly used methods due to their flexibility and power.

function initialFirstKeyword() {
  // # here represents ID selector in CSS
  const firstKeyword = document.querySelector("#keywordInput");
  if (firstKeyword) {
    firstKeyword.value = "Python";
  }
   const searchButton = document.querySelector("#searchButton");
  if (searchButton) {
    searchButton.click(); // 正确：触发点击
  }
}

// ===================================================
// functions for rendering keyword search statistics 
// ===================================================

function renderKeywordHeader() {
  const searchButton = document.querySelector("#searchButton");
  const searchHeader = document.querySelector("#searchKeyword");
  const keywordInput = document.querySelector("#keywordInput");

  // update header when search button is clicked
  // this event listener stays active throughout the page lifecycle once added
  if (searchButton && searchHeader && keywordInput) {
    searchButton.addEventListener('click', () => {
      searchHeader.textContent = keywordInput.value;
    });
  }
}

// this function is triggered by the search button's onclick event
// TODO: using api/jobs/stats/by-level here would be more efficient than the current api/jobs/stats/count
// it avoids sending 4 separate requests for each job level count
async function fetchJobCountsForAllLevels() {
  
  const levels = ['All', 'Junior', 'Intermediate', 'Senior'];

  const queries = levels.map(level => {
    const params = new URLSearchParams();
    // only add job_level param if level is not 'All'
    // cause the basic SQL query is designed to return all levels count when no job_level filter is applied
    if (level !== 'All') params.append('job_level', level);

    // example for URL with params:
    // All levels: api/jobs/stats/count
    // Junior level: api/jobs/stats/count?job_level=Junior  
    return fetch(`${window.API_BASE}/api/stats/jobs/count?${params.toString()}`)
      .then(res => res.json())
      .then(data => ({
        level,
        count: data.count
      }));
  });

  // wait for all queries to complete
  const levelCounts = await Promise.all(queries);

  renderHeaderWithCounts(levelCounts);
}

function renderHeaderWithCounts(levelCounts) {
  
  // there are two selectors here, meaning we select the <tr> inside <thead>
  const headerRow = document.querySelector('thead tr');

  // clear existing header content
  headerRow.innerHTML = '<th class="px-4 py-2">#</th>';

  const labelMap = {
    all:          'ALL Jobs',
    junior:       '🧑‍🎓Junior&Graduate',
    intermediate: '👨‍💻Intermediate',
    senior:       '👨‍💼Senior'
  };

  // recreate header cells with counts
  levelCounts.forEach(item => {
    const label = labelMap[item.level.toLowerCase()] || item.level;
    const count = item.count;

    const th = document.createElement('th');
    th.className = 'px-3 py-2';
    th.innerHTML = `${label}<br>(${count})`;
    headerRow.appendChild(th);
  });
}

async function fetchKeywordMentionStats() {

  const keywordInput = document.getElementById('keywordInput');
  const keyword = keywordInput?.value.trim();
  if (!keyword) return;

  // encodeURIComponent is a built-in JS function to encode specifial characters in URL parameters
  // the ? after search/stats is a fixed part of URL to indicate the start of parameters
  // our backend defines a query parameter named 'keyword', so we must use keyword= here when building the URL
  // actually, we can remove encodeURIComponent here and this will still work for most normal keywords without special characters
  // but it's a good practice to always encode URL parameters to avoid potential issues with special characters
  const url = `${window.API_BASE}/api/jobs/search/stats?keyword=${encodeURIComponent(keyword)}`;
  try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch data');
      const data = await res.json();

      renderMentionRateRow(data);

  } catch (err) {
      console.error('Error fetching keyword stats:', err);
  }

}

function renderMentionRateRow(data) {

  const keywordInput = document.querySelector("#keywordInput");
  const matchRow = document.getElementById('matchCountRow');
  const rateRow = document.getElementById('mentionRateRow');
  if (!matchRow || !rateRow) return;

  // clear existing row content
  matchRow.innerHTML = '<td class="px-4 py-2">Total Jobs with <strong>' + keywordInput.value + '</strong></td>';
  rateRow.innerHTML  = '<td class="px-4 py-2">% of Jobs Mentioning<br><strong>' + keywordInput.value + '</strong></td>';

  const levelOrder = ['All','Junior', 'Intermediate', 'Senior'];

  // object.fromEntries is a built-in JS function
  // it converts a list of 2 element arrays into an object, and the first element of each array is the key, the second element is the value
  const levelMap = Object.fromEntries(
    // convert every item into a 2 element array [level, item]
    data.map(item => [item.level, item])
  );
  // JS doesn't provide a function to directly convert array of objects into an key-value mapping object, so we need to convert each item in the array into a 2 element array first
  // then use Object.fromEntries to convert each 2 element array into key-value pairs in the final object
  // please note that, in JS, we use objects as dictionaries because they serve the same purpose
  // JS doesn't have a built-in dictionary type like some other languages

  // In JS, for.. of loop is used to iterate over the values of iterable objects like arrays, maps, etc.
  // for.. in loop is used to iterate over the keys(property names)  of an object, including array indices
  for (const level of levelOrder) {
    const match = levelMap[level];

    // Match Count 单元格
    const matchCell = document.createElement('td');
    matchCell.className = 'px-4 py-2';
    matchCell.textContent = match ? match.matchCount : '0';
    matchRow.appendChild(matchCell);

    // Mention Rate 单元格
    const rateCell = document.createElement('td');
    rateCell.className = 'px-4 py-2';
    rateCell.textContent = match ? `${match.percentage.toFixed(1)}%` : '0.0%';
    rateRow.appendChild(rateCell);
  }
}

// ======================================================
// functions for rendering matching job list and details
// ======================================================

// this function is triggered by the search button's onclick event
async function renderMatchingJobList() {

    const keywordInput = document.getElementById('keywordInput');
    const keyword = keywordInput?.value.trim();
    if (!keyword) return;

    const url = `${window.API_BASE || ''}/api/jobs/search/list?keyword=${encodeURIComponent(keyword)}`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch matching jobs');
        matchedJobs = await res.json();

        // 重置计数与容器
        displayCount = 0;
        const container = document.getElementById('jobListContainer');
        container.innerHTML = '';

        if (matchedJobs.length === 0) {
            container.innerHTML = `<p class="text-gray-500">No matching jobs found.</p>`;
            document.getElementById('load-more-btn').style.display ='none';
            const jobDescriptionContainer = document.getElementById('jobDescriptionContainer');
            jobDescriptionContainer.innerHTML = 'This area will be populated with the actual job description relevant to your keyword when a job is selected.'; // 清空详情容器
            jobDescriptionContainer.classList.add('text-gray-500', 'text-start', 'p-8');
            return;
        }
        // 立刻显示第一页
        showMoreJobs();
        
        const jobDescriptionContainer = document.getElementById('jobDescriptionContainer');
          jobDescriptionContainer.innerHTML = 'This area will be populated with the actual job description relevant to your keyword when a job is selected.'; // 清空详情容器
          jobDescriptionContainer.classList.add('text-gray-500', 'text-start', 'p-8');

    } catch (err) {
        console.error('Error loading matching jobs:', err);
    }
}

function showMoreJobs() {

  const container   = document.getElementById('jobListContainer');
  const PAGE_SIZE   = 20;
  const defaultBg   = 'bg-gray-100';
  const selectedBg  = 'bg-blue-100';
  const start       = displayCount;
  const end         = Math.min(start + PAGE_SIZE, matchedJobs.length);

  // loop through each matched job and create its div
  for (let i = start; i < end; i++) {
    const job = matchedJobs[i];
    const div = document.createElement('div');

    // 1) 一次性添加所有共用类
    div.classList.add(
      'job-row',                  // 标记行
      'flex','justify-between','items-center',
      'p-4','rounded-lg','shadow','hover:border-blue-500','hover:scale-105','hover:bg-blue-100','hover:border-2','hover:border-blue-300',
      'transition-transform','duration-300',
      'cursor-pointer',           // 鼠标悬停时显示手型
      defaultBg                   // 默认背景
    );

    // 标题
    const title = document.createElement('p');
    title.textContent = job.jobTitle;
    // 时间
    const info = document.createElement('div');
    info.innerHTML = `
      <p class="text-gray-400 text-sm text-nowrap">Posted on</p>
      <p class="text-gray-500">#${
        job.listedDate
          ? new Date(job.listedDate).toLocaleDateString('en-NZ')
          : 'N/A'
      }</p>
    `;

    div.append(title, info);
    container.appendChild(div);

    // add click event listener to each job div
    div.addEventListener('click', () => {
      // 先把所有行恢复成灰色
      container.querySelectorAll('.job-row').forEach(el => {
        el.classList.replace(selectedBg, defaultBg);
      });
      // 再把当前行变成蓝色
      div.classList.replace(defaultBg, selectedBg);

      // 渲染详情
      const kw = document.getElementById('keywordInput').value.trim();
      renderJobDescription(job, kw);
    });
  }

  displayCount = end;
  document.getElementById('load-more-btn').style.display =
    displayCount < matchedJobs.length ? 'block' : 'none';
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderJobDescription(job, keyword) {
  // console.log('Keyword:', keyword);
  // console.log('Full jobDescription:', job.jobDescription);
  const container = document.getElementById('jobDescriptionContainer');
  container.innerHTML = '';

  // the jobDescription is in HTML format, so we need to parse it first, then extract needed parts by DOM methods
  const parser = new DOMParser();
  const doc = parser.parseFromString(job.jobDescription || '', 'text/html');

  // Get all <p> and <li> nodes
  const nodes = Array.from(doc.querySelectorAll('p, li'));

  // this line turns the user's keyword into a safe, case-insensitive regex pattern
  // it the user type special characters that could break a normal regex, we escape them first so the search won't crash
  // escape means to make special characters lose their special meaning in regex
  const re = new RegExp(`(${escapeRegExp(keyword)})`, 'i');

  // Find all node indices containing the keyword
  const matches = nodes
    // loop through all nodes and check if the text content matches the regex, if yes, return the index, otherwise return -1
    .map((node, i) => re.test(node.textContent) ? i : -1)
    // filter out the -1 results, keep only the matched indices
    .filter(i => i >= 0);

  if (matches.length === 0) {
    container.textContent = 'No matching snippet.';
    return;
  }

  // Collect indices to display (including one paragraph before and after each match)
  const indices = new Set();
  // loop through each matched index
  matches.forEach(i => {
    for (let d = -1; d <= 1; d++) {
      const j = i + d;
      // for each matched index, also add the previous and next index if within bounds
      if (j >= 0 && j < nodes.length) indices.add(j);
    }
  });

  // convert set to sorted array first
  Array.from(indices).sort((a, b) => a - b).forEach(i => {
    
    // get the full HTML of this node
    const html = nodes[i].outerHTML;

    // highlight the keyword in the HTML
    const highlighted = html.replace(
      new RegExp(`(${escapeRegExp(keyword)})`, 'gi'),
      '<span class="text-red-500">$1</span>'
    );
    container.insertAdjacentHTML('beforeend', highlighted);
  });

  // if jobURL exists, add a link at the bottom
  if (job.jobUrl) {
    const linkWrapper = document.createElement('p');
    linkWrapper.className = 'mt-4 text-left';
    linkWrapper.innerHTML = `
      <a 
        href="${job.jobUrl}" 
        target="_blank" 
        rel="noopener noreferrer" 
        class="text-blue-500 hover:underline"
      >
        View This Job Posting
      </a>
    `;
    container.appendChild(linkWrapper);
  }

}

