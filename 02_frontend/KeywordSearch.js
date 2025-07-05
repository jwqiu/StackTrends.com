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
  const bodyRow   = document.querySelector('tbody tr');

  headerRow.innerHTML = '<th class="px-4 py-2">#</th>';
  bodyRow.innerHTML   = '<td class="px-4 py-2">Mention Rate</td>';

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

    const td = document.createElement('td');
    td.className = 'px-3 py-2';
    td.textContent = ((count / total) * 100).toFixed(1) + '%';
    bodyRow.appendChild(td);
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
  const matchRow = document.getElementById('matchCountRow');
  const rateRow = document.getElementById('mentionRateRow');
  if (!matchRow || !rateRow) return;

  // 清空旧内容（保留 label 列）
  matchRow.innerHTML = '<td class="px-4 py-2">Match Count</td>';
  rateRow.innerHTML  = '<td class="px-4 py-2">Mention Rate</td>';

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

      // 立刻显示第一页
      showMoreJobs();
    } catch (err) {
      console.error('Error loading matching jobs:', err);
    }
  }

  function showMoreJobs() {
    const container = document.getElementById('jobListContainer');
    const start = displayCount;
    const end = Math.min(displayCount + PAGE_SIZE, matchedJobs.length);

    for (let i = start; i < end; i++) {
      const job = matchedJobs[i];
      const div = document.createElement('div');
      div.className = 'flex justify-between items-center bg-gray-100 p-4 rounded-lg shadow';

      const title = document.createElement('p');
      title.textContent = job.jobTitle;

      const info = document.createElement('div');
      info.innerHTML = `
        <p class="text-gray-400 text-sm text-nowrap">Posted on</p>
        <p class="text-gray-500">#${job.listedDate 
                ? new Date(job.listedDate).toLocaleDateString('en-NZ') 
                : 'N/A'}</p>
      `;

      div.appendChild(title);
      div.appendChild(info);
      container.appendChild(div);
    }

    displayCount = end;
    // 控制 Load More 按钮显隐
    document.getElementById('load-more-btn').style.display =
      displayCount < matchedJobs.length ? 'block' : 'none';
  }

  // 绑定 Load More
  document.getElementById('load-more-btn')
    .addEventListener('click', showMoreJobs);

  // 绑定 Search
  document.getElementById('searchButton')
    .addEventListener('click', renderMatchingJobList);