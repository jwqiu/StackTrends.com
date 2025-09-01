const API_BASE = window.API_BASE;

document.addEventListener('DOMContentLoaded', () => {
    renderKeywordHeader();
    initialFirstKeyword();
});


function initialFirstKeyword() {
  const firstKeyword = document.querySelector("#keywordInput");
  if (firstKeyword) {
    firstKeyword.value = "Python";
  }
   const searchButton = document.querySelector("#searchButton");
  if (searchButton) {
    searchButton.click(); // 正确：触发点击
  }
}

function renderKeywordHeader() {
  const searchButton = document.querySelector("#searchButton");
  const searchHeader = document.querySelector("#searchKeyword");
  const keywordInput = document.querySelector("#keywordInput");

  if (searchButton && searchHeader && keywordInput) {
    searchButton.addEventListener('click', () => {
      searchHeader.textContent = keywordInput.value;
      searchHeader.classList.remove('text-gray-500');
      searchHeader.classList.add('text-gray-600');
    });
  }
}

async function fetchJobCountsForAllLevels() {
  const levels = ['All', 'Junior', 'Intermediate', 'Senior'];

  const queries = levels.map(level => {
    const params = new URLSearchParams();
    if (level !== 'All') params.append('job_level', level);

    return fetch(`${window.API_BASE}/api/Job/count?${params.toString()}`)
      .then(res => res.json())
      .then(data => ({
        level,
        count: data.count
      }));
  });

  const levelCounts = await Promise.all(queries);
  renderHeaderWithCounts(levelCounts);
}



function renderHeaderWithCounts(levelCounts) {
  const headerRow = document.querySelector('thead tr');
  // const bodyRow   = document.querySelector('tbody tr');

  headerRow.innerHTML = '<th class="px-4 py-2">#</th>';
  // bodyRow.innerHTML   = '<td class="px-4 py-2">Mention Rate</td>';

  const labelMap = {
    all:          'ALL Jobs',
    junior:       '🧑‍🎓Junior&Graduate',
    intermediate: '👨‍💻Intermediate',
    senior:       '👨‍💼Senior'
  };

  const total = levelCounts.find(item => item.level.toLowerCase() === 'all')?.count || 1;

  levelCounts.forEach(item => {
    const label = labelMap[item.level.toLowerCase()] || item.level;
    const count = item.count;

    const th = document.createElement('th');
    th.className = 'px-3 py-2';
    th.innerHTML = `${label}<br>(${count})`;
    headerRow.appendChild(th);

    // const td = document.createElement('td');
    // td.className = 'px-3 py-2';
    // td.textContent = ((count / total) * 100).toFixed(1) + '%';
    // bodyRow.appendChild(td);
  });
}

async function fetchKeywordMentionStats() {
    const keywordInput = document.getElementById('keywordInput');
    const keyword = keywordInput?.value.trim();
    if (!keyword) return;

    const url = `${window.API_BASE}/api/count/match/keyword?keyword=${encodeURIComponent(keyword)}`;
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

  // 清空旧内容（保留 label 列）
  matchRow.innerHTML = '<td class="px-4 py-2">Total Jobs with <strong>' + keywordInput.value + '</strong></td>';
  rateRow.innerHTML  = '<td class="px-4 py-2">% of Jobs Mentioning<br><strong>' + keywordInput.value + '</strong></td>';


  // 构建等级映射
  const levelOrder = ['Junior', 'Intermediate', 'Senior'];
  const levelMap = Object.fromEntries(data.levelBreakdown.map(l => [l.level, l]));

  // 添加 ALL 区块（match count 和百分比）
  const allMatchCell = document.createElement('td');
  allMatchCell.className = 'px-4 py-2';
  allMatchCell.textContent = data.totalMatches;
  matchRow.appendChild(allMatchCell);

  const allRateCell = document.createElement('td');
  allRateCell.className = 'px-4 py-2';
  allRateCell.textContent = `${data.overallPercentage.toFixed(1)}%`;
  rateRow.appendChild(allRateCell);

  // 各等级
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

// async function renderMatchingJobList() {
//   const keywordInput = document.getElementById('keywordInput');
//   const keyword = keywordInput?.value.trim();
//   if (!keyword) return;

//   const url = `${window.API_BASE || ''}/api/job/search/by-keyword?keyword=${encodeURIComponent(keyword)}`;
//   try {
//     const res = await fetch(url);
//     if (!res.ok) throw new Error('Failed to fetch matching jobs');
//     const jobs = await res.json();

//     const container = document.getElementById('jobListContainer');
//     container.innerHTML = ''; // 清空旧内容

//     if (jobs.length === 0) {
//       container.innerHTML = `<p class="text-gray-500">No matching jobs found.</p>`;
//       return;
//     }

//     jobs.forEach(job => {
//       const div = document.createElement('div');
//       div.className = 'flex justify-between items-center bg-gray-100 p-4 rounded-lg shadow';

//       const title = document.createElement('p');
//       title.textContent = job.jobTitle;

//       const info = document.createElement('div');
//       info.innerHTML = `
//         <p class="text-gray-400 text-sm text-nowrap">Posted on</p>
//         <p class="text-gray-500">#${job.listedDate 
//                 ? new Date(job.listedDate).toLocaleDateString('en-NZ') 
//                 : 'N/A'}</p>
//       `;

//       div.appendChild(title);
//       div.appendChild(info);
//       container.appendChild(div);
//     });

//   } catch (err) {
//     console.error('Error loading matching jobs:', err);
//   }
// }

let matchedJobs = [];
let displayCount = 0;
const PAGE_SIZE = 20;

async function renderMatchingJobList() {
    const keywordInput = document.getElementById('keywordInput');
    const keyword = keywordInput?.value.trim();
    if (!keyword) return;

    const url = `${window.API_BASE || ''}/api/job/search/by-keyword?keyword=${encodeURIComponent(keyword)}`;
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

    // 点击切换高亮
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


  // 绑定 Load More
  document.getElementById('load-more-btn')
    .addEventListener('click', showMoreJobs);

  // 绑定 Search
  document.getElementById('searchButton')
    .addEventListener('click', renderMatchingJobList);


function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderJobDescription(job, keyword) {
  console.log('Keyword:', keyword);
  console.log('Full jobDescription:', job.jobDescription);
  const container = document.getElementById('jobDescriptionContainer');
  container.innerHTML = '';

  // 1. 把后端返回的 HTML 字符串解析成 document
  const parser = new DOMParser();
  const doc = parser.parseFromString(job.jobDescription || '', 'text/html');

  // 2. 拿到所有的 <p> 和 <li> 节点
  const nodes = Array.from(doc.querySelectorAll('p, li'));

  // 3. 定义正则（不带 g，否则 test 会乱序；带 i 忽略大小写）
  const re = new RegExp(`(${escapeRegExp(keyword)})`, 'i');

  // 4. 找出所有包含关键字的节点索引
  const matches = nodes
    .map((node, i) => re.test(node.textContent) ? i : -1)
    .filter(i => i >= 0);

  if (matches.length === 0) {
    container.textContent = 'No matching snippet.';
    return;
  }

  // 5. 收集需要显示的索引（包含匹配前后各一段落）
  const indices = new Set();
  matches.forEach(i => {
    for (let d = -1; d <= 1; d++) {
      const j = i + d;
      if (j >= 0 && j < nodes.length) indices.add(j);
    }
  });

  // 6. 按索引顺序渲染，每段保留原 HTML 结构并高亮关键字
  Array.from(indices).sort((a, b) => a - b).forEach(i => {
    const html = nodes[i].outerHTML;
    const highlighted = html.replace(
      new RegExp(`(${escapeRegExp(keyword)})`, 'gi'),
      '<span class="text-red-500">$1</span>'
    );
    container.insertAdjacentHTML('beforeend', highlighted);
  });

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

document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("menu-toggle");
  const menu = document.getElementById("menu");

  toggleBtn.addEventListener("click", () => {
    menu.classList.toggle("hidden");
  });
});