// import { mockData } from './mockData.js';
const API_BASE = window.API_BASE;
let topChart;
let experienceChart = null;
let selectedIndex = -1;
let level_labels = [];
let allLevelData = []; // only data for "All" level
let allData = []; // data including all levels
let levelCounts = [];

// if the page visibility changes ( the user switch to another tab and come back, or adjust the size of browser window )
// reset and update the chart to avoid rendering issues
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && topChart) {
    topChart.reset();
    topChart.update({ duration: 0 });
  }
});

// when the page loads, the following functions will be executed
document.addEventListener('DOMContentLoaded', () => {
  //----------------------------------------------------------------------------------------------------------------------
  // load the data used for first and second section, which includes the overall rankings and rankings by category
  // the processing and rendering UI logic will be triggered inside the loadTechRankData function
  //----------------------------------------------------------------------------------------------------------------------
  loadTechRankData(); 
  renderFiltersOptions(); // Load and render filter options for the overall ranking table

  //----------------------------------------------------------------------------------------------------------------------
  // start triggering the data fetching and rendering for the third section, which is the rankings by experience level
  //----------------------------------------------------------------------------------------------------------------------
  fetchLevelCounts();

  //---------------------------------------------------------------
  // trigger the last section, which is the rankings by company
  //---------------------------------------------------------------
  renderTechStackByCompany(20);

  //-------------------------------------
  // set up admin login-related functions
  //-------------------------------------
  setupAdminLinkClickEvent();
  fetchLoginModal();
  
  //-------------------------------------
  // helper functions
  //-------------------------------------
  updateJobCount(); // update job count number displayed on the page
  initFadeInOnView(); // initialize the fade-in animation for various sections
  setupToggleBtnClickEvent(); 

});

// ========================================================================
// the overall tech stack ranking table and chart
// ========================================================================

// load the ranking data and trigger rendering functions(including a table and a chart in first section, and rankings by category in the second section)
// when the page loads, I use a separate function to fetch data from the backend and then trigger the rendering functions
// this way, the data fetching and rendering logic are separated, making the code more modular and easier to maintain
async function loadTechRankData() {
  try {
    const response = await fetch(`${window.API_BASE}/api/rankings/by-level`);
    allData = await response.json();

    allLevelData = allData
      .filter(item => (item.level ?? item.Level)?.toLowerCase() === 'all')
      .sort((a, b) =>
        (b.percentage ?? b.Percentage) - (a.percentage ?? a.Percentage)
      );
    renderTechTableRows(allLevelData);
    renderRankingsByCategory(allLevelData);
    
    // only show top 10 in the bar chart
    const top10= allLevelData.slice(0, 10); // Get top 10 items
    let labels = top10.map(item => item.technology ?? item.Technology);
    labels = labels.map(label => label.charAt(0).toUpperCase() + label.slice(1));
    const counts = top10.map(item => item.percentage ?? item.Percentage);
    
    // after loading the data, initialize the chart
    if (!topChart) {
      initChart(labels, counts);
    } else {
      topChart.data.labels = labels;
      topChart.data.datasets[0].data = counts;
      topChart.update();
    }

  } catch (err) {
    console.error('Failed to load tech stack data:', err);
  }
}

function initChart(labels, data) {
  // destroy existing chart instance if any, otherwisre might get error
  topChart?.destroy(); 
  console.log(labels);

  const barThickness = 50;            // 和 options 一致
  const padding = 32;                 // 可根据实际调整
  const height = labels.length * barThickness + padding;
  const canvas = document.getElementById('myChart');
  canvas.height = height;
  canvas.style.height = height + 'px'; 

  const ctx = canvas.getContext('2d');

  topChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        borderWidth: 1,
        barPercentage: 1,      // 条在分类格子里占80%高度
        categoryPercentage: 0.7, // 每个分类格子本身占用可用空间的80%
        // barThickness: barThickness,        // 绝对高度，直接控制条的“粗细”

        backgroundColor: [
          '#60a5fa', // Azure - 深蓝
          '#93c5fd', // AWS - 中深蓝
          '#bfdbfe', // React - 中蓝
          '#dbeafe', // C# - 浅蓝
          '#e0f2fe', // JavaScript - 最浅蓝
          '#e5e7eb', // .NET - 浅灰
          '#e5e7eb', // TypeScript - 浅灰
          '#e5e7eb', // Python - 浅灰
          '#e5e7eb', // Git - 浅灰
          '#e5e7eb'  // CSS - 浅灰
        ]
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,     // ← 这一行打开
      layout: {
        padding: { left: 20, top: 0, bottom: 0 }
      },
      scales: {
        y: {
          beginAtZero: true,  // 关闭自动从0开始
          offset: true,
          // min: 0,             
          // max: 0.5,
          grid: {
            display: false,
            // ↓ 确保“轴线”也不画
            drawBorder: false,
            // （可选）彻底透明
            borderColor: 'transparent',
          },
          // ② 刻度值 & 刻度小线 关闭
          ticks: {
            display: true,
            drawTicks: false,
            // align: 'start',
            font: {
              size: 15,        // ✅ 字体大小
              family: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            },
            crossAlign: 'far',
            padding: 4,
            autoSkip: false,
            
          },
          // ③ 也要把轴本身的 border 关掉
          border: {
            display: false
          }
        },
        x: {
          // ① 网格线 (竖线) 关闭
          grid: {
            display: false,
            drawBorder: false,
            borderColor: 'transparent',
          },
          // ② 刻度值 & 刻度小线 关闭
          ticks: {
            display: false,      // ✅ 显示标签
            drawTicks: false,   // ❌ 不画刻度小线
            font: { size: 8 },
            color: '#4b5563',
            align: 'start'

          },
          // ③ 也把 X 轴的主边框线关掉
          border: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: false,
          text: '              Top 10 Tech Stacks by % of Jobs Mentioned',
          align: 'start', 
          font: { size: 18, weight: 'normal' },
          padding: { top: 10, bottom: 20 }
        },
        tooltip: {
          backgroundColor: '#1e3a8a', // 深蓝色背景
          titleColor: '#fff',
          bodyColor: '#f9fafb',
          cornerRadius: 4,
          padding: 8,
          callbacks: {
            label: function(context) {
              const value = context.raw;
              return `${(value * 100).toFixed(2)}%`;
            }
          }
        },
        datalabels: {
          anchor: 'end',
          align: function(context) {
            const value = context.dataset.data[context.dataIndex];
            return value < 0.05 ? 'end' : 'start';
          },
          offset: 4,
          clip: false,
          font: {
            size: 12
          },
          color: '#374151', // text-gray-800
          formatter: function(value) {
            return `${(value * 100).toFixed(2)}%`;
          },
          animation: { duration: 0 } 
        },

      },
      elements: {
        bar: {
          borderRadius: 10, // ✅ 圆角柱状条
          borderSkipped: false,
          barThickness: barThickness // 控制柱子宽度
        }
      },
      animation: {
        delay: function (context) {
          const index = context.dataIndex;
          return index * 100;
        },
        duration: 800,
        easing: 'easeOutQuart',
        animations: {
          x: false,
          y: false,
          radius: false,
          colors: false,
          borderWidth: false,
          tension: false
        }
      }
    }
   
  });
  // window.dispatchEvent(new Event('resize'));
}

// render the table on the right side of the chart
async function renderTechTableRows(data, limit) {
  const tbody = document.getElementById('techTable');
  tbody.innerHTML = '';
  // if limit is provided, only render up to that number of rows, if not, render all
  (limit ? data.slice(0, limit) : data).forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="border px-4 py-2">${item.category ?? item.Category}</td>
      <td class="border px-4 py-2">${
        (item.technology ?? item.Technology)
          .charAt(0).toUpperCase() + (item.technology ?? item.Technology).slice(1)
      }</td>
      <td class="border px-4 py-2">${item.mentions ?? item.Mentions}</td>
      <td class="border px-4 py-2">${((item.percentage ?? item.Percentage) * 100).toFixed(2)}%</td>
    `;
    tbody.appendChild(tr);
  });
}

async function renderFiltersOptions() {
  const root = document.getElementById('category-filters');
  root.innerHTML = '';

  // create a dropdown button/trigger
  const trigger = document.createElement('div');
  trigger.className =
    'flex max-w-[220px] overflow-hidden items-center px-8 py-2 text-lg text-gray-600 rounded-lg cursor-pointer bg-white   ';
  
  // build the dropdown trigger content, label + icon
  const triggerLabel = document.createElement('span');
  triggerLabel.className = 'truncate';
  triggerLabel.textContent = 'All';
  trigger.innerHTML = `
    <span class="trigger-label truncate">${triggerLabel.textContent}</span>
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
        stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
      <path stroke-linecap="round" stroke-linejoin="round"
            d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  `;
  const triggerTitle = trigger.querySelector('.trigger-label');

  // filter options menu
  const menu = document.createElement('div');
  menu.className =
    'absolute right-0 mt-2 w-60 p-4 flex flex-col gap-y-2 bg-white rounded-xl shadow-xl hidden flex flex-col z-40';

  // factory function: create buttons for each filter option
  const makeBtn = (label) => {
    const btn = document.createElement('button');
    btn.className =
      'filter-btn bg-white text-left rounded-lg px-3 py-1 text-lg hover:bg-blue-100';
    btn.dataset.filter = label;
    btn.textContent = label;
    // close the menu and filter the table when clicking this button
    btn.addEventListener('click', () => {
      const filterValue = label.toLowerCase();
      filterTable(filterValue, btn);

      triggerTitle.textContent = label;  // 改变显示文字
      menu.classList.add('hidden');      // 收起菜单
    });
    return btn;
  };

  // manually create an ALL button
  const allBtn = makeBtn('All');
  menu.appendChild(allBtn);

  // fetch category list and create button for each category
  const res = await fetch(`${API_BASE}/api/categories`);
  const cats = await res.json();
  cats.forEach(c => {
    menu.appendChild(makeBtn(c.name));
  });

  // open or close the filter options menu when clicking the trigger
  trigger.addEventListener('click', (e) => {
    e.stopPropagation(); 
    menu.classList.toggle('hidden');
  });

  root.appendChild(trigger);
  root.appendChild(menu);

  // manually trigger the ALL button when first load
  allBtn.click();

  // close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!trigger.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });

}

function filterTable(filterValue,clickedButton) {  
  // the let variable works within the current function scope
  let filteredData;

  if (filterValue === 'all') {

    renderTechTableRows(allLevelData);
    filteredData = allLevelData; // 全部数据

  } else {

    renderTechTableRows(allLevelData); // 先渲染全部数据
    const rows = document.querySelectorAll('#techTable tr');

    // select only rows that match the filter category to show
    rows.forEach(row => {
      const category = row.cells[0].textContent.toLowerCase();
      if (category === filterValue) {
        row.style.display = ''; // Show row
      } else {    
        row.style.display = 'none'; // Hide row
      }
    });
    filteredData = allLevelData.filter(item =>
      (item.category ?? item.Category).toLowerCase() === filterValue
    );
  }

  // update the bar chart based on the filtered data
  // get the top 10 items from the filtered data
  const top10 = filteredData.slice(0, 10); // Get top 10 items
  const labels = top10.map(item => {
    let name = item.technology ?? item.Technology ?? "";
    // 首字母大写
    name = name.charAt(0).toUpperCase() + name.slice(1);
    // 如果包含空格，则按空格拆分成多行
    return name.includes(' ') ? name.split(' ') : name;
  });

  const counts = top10.map(item => item.percentage ?? item.Percentage);
  console.log('filteredData.length =', filteredData.length, filteredData);
  console.log('labels.length =', labels.length, labels);
  initChart(labels, counts);

  // remove the highlight from all buttons first, and then add highlight to the clicked button
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.remove('bg-blue-500','text-white');
    b.classList.add('bg-gray-200','text-gray-700');
  });

  clickedButton.classList.remove('bg-gray-200','text-gray-700');
  clickedButton.classList.add('bg-blue-500','text-white');
}

// ========================================================================
// tech stack rankings by category
// ========================================================================

function renderRankingsByCategory(data) {
  const categoryOrder = [
    "Frontend",
    "Backend",
    "Coding Methods and Practices",
    "Cloud Platforms",
    "DevOps Tools",
    "Database",
    "AI",
    "Other"
  ];

  // loop through all items and group them by category
  const grouped = {};
  data.forEach(item => {
    const category = item.category ?? item.Category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
  });

  // loop through each category in the predefined order and render the top 5 items
  categoryOrder.forEach(cat => {
    const techList = (grouped[cat] || [])
      .sort((a, b) => (b.mentions ?? b.Mentions) - (a.mentions ?? a.Mentions))
      .slice(0, 5); // 可调整显示数量

    // the container div for each category already exists and predefined in the HTML
    const container = document.getElementById(cat);
    if (!container) return;

    let html = "";

    techList.forEach((item, idx) => {
      const rawName = item.technology ?? item.Technology;
      const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      const percentageRaw = item.percentage ?? item.Percentage;
      const percentage = (percentageRaw * 100).toFixed(2) + '%';

      html += `
        <div class="">
          <div class="py-3 w-full rounded-md overflow-hidden group transition-transform duration-300 hover:scale-105  shadow-lg relative">
            <div class="absolute top-0 left-0 w-full h-full bg-gradient-to-r group-hover:from-gray-300 group-hover:to-gray-100 from-white to-white"></div>
            <div class="absolute top-0 left-0 h-full bg-gradient-to-r group-hover:from-blue-600 group-hover:to-blue-200 from-blue-500 to-blue-100 rounded-md" style="width: ${percentage}"></div>
            <div class="relative z-10 flex items-center group-hover:justify-center h-full px-2">
              <span class="text-sm text-gray-600 text-shadow font-bold  hidden group-hover:inline group-hover:opacity-100 transition-opacity duration-200">
                ${percentage}
              </span>
              <span class="w-full text-md text-center  group-hover:font-bold group-hover:hidden truncate text-sm text-gray-600  " title="${name}">
                ${name}
              </span>
            </div>
          </div>
        </div>
      `;
    });

      // 填充到对应div
    container.innerHTML = html;
  });

}

// ========================================================================
// tech stack rankings by different experience levels
// ========================================================================

// fetch job counts for each experience level and then trigger the header rendering and table rendering
function fetchLevelCounts() {

  return fetch(`${API_BASE}/api/stats/jobs/level`)

    .then(resp => {
      if (!resp.ok) throw new Error('请求失败 ' + resp.status);
      return resp.json();
    })
    .then(json => {
      levelCounts = json;
      renderTopTechStackTableByLevel();
    })
    .catch(err => {
      console.error(err);
    });
}

// const and let are the most commonly used ways to declare variables in JavaScript
// the difference between const and let is that the const variable cannot be reassigned, while the let variable can be reassigned
// let and const only work inside the curly braces{} of the function or block they are declared in 
function renderTechStackByLevelHeader(levels){
  // 生成表格 HTML
  let html = `
    <thead class=" border-none text-gray-700">
      <tr>
        <th class="px-0 py-2"></th>
         ${levels.map(l => {
            const count = levelCounts.find(c => (c.level ?? c.Level).toLowerCase() === l.key)?.count || 0;
            return `<th class="px-4 font-normal py-2 text-lg text-center">${l.label}<br> <span class="text-sm text-gray-400">(${count} jobs)</span></th>`;
          }).join("")}
      </tr>
    </thead>
    <tbody class="text-gray-800">
  `;
  return html
}

async function renderTopTechStackTableByLevel() {
  
  const levels = [
    { key: "junior",        label: "🧑‍🎓 Junior&Graduate" },
    { key: "intermediate",  label: "👨‍💻 Intermediate"    },
    { key: "senior",        label: "👨‍💼 Senior"          }
  ];

  // call API in parallel to get ranking data for each level
  const responses = await Promise.all(
    levels.map(lvl =>
      fetch(`${window.API_BASE}/api/rankings/by-level?level=${lvl.key}`)
        .then(res => res.json())
    )
  );

  // createa a data structure to hold the table data
  // this data will be used to render the table rows later
  const tableData = {};
  // idx just tells us which level we’re on, and responses[idx] gives the matching data,
  // because the requests are sent in the same order as the levels array (junior → intermediate → senior).
  levels.forEach((lvl, idx) => {
    const arr = responses[idx];

    // only group the data by category, doesn't include level here
    const grouped = {};
    arr.forEach(item => {
      const cat  = item.category   ?? item.Category;
      const tech = item.technology ?? item.Technology;
      const ment = item.mentions   ?? item.Mentions;

      // if the category doesn't exist in grouped yet, create an empty array for it
      if (!grouped[cat]) grouped[cat] = [];

      const perc = item.percentage ?? item.Percentage;
      grouped[cat].push({ tech, ment, perc });

    });
    // only keep the top 3 technologies per category
    // object.entries convert the grouped object into an array of [key, value] pairs
    // so that we can use forEach to loop through each category and its corresponding array of technologies
    Object.entries(grouped).forEach(([cat, arr2]) => {
    const top3 = arr2
      .sort((a, b) => b.ment - a.ment)
      .slice(0, 3);
      // added grouped category data into the tableData, organized by category and level
      if (!tableData[cat]) tableData[cat] = {};
      tableData[cat][lvl.key] = top3;
    });
  });

  // render the table rows in order of predefined categories
  const categoryOrder = [
    "Frontend","Backend","Coding Methods and Practices","Cloud Platforms",
    "DevOps Tools","Database","AI"
  ];
  // first, rendering the table header, which is the job counts for each level
  let html = renderTechStackByLevelHeader(levels);

  // first render the table row by row — each row represents a category.
  // in most cases, a table is rendered row by row rather than column by column
  categoryOrder.forEach(cat => {
    // render the first column, which is the category name with a circle 
    html += `<tr class="">
      <td class="px-4 py-2">
        <div class="relative w-16 h-16 flex items-center justify-center ">
          <span class="relative text-lg font-bold text-gray-600 z-10">${cat}</span>
          <span class="absolute inset-0 bg-gray-200 rounded-full"></span>
        </div>
      </td>
      ${levels.map(lvl => {
        // render the following columns, which are the top 3 technologies for each level in that category
        // create a variable arr to hold the array of top technologies for that category and level
        const arr = tableData[cat]?.[lvl.key] || [];
        // Both map() and forEach() can be used on arrays, but map() is meant to return a new value for each element, while forEach() doesn't return anything.
        // in general, the forEach() doesn't return anything, instead we store the processed data in an external variable
        const displayArr = arr.map((val, idx) => {
            const width = `${(val.perc * 100).toFixed(2)}%`;
            const label = `${capitalize(val.tech)}`;            

            return `
              <span class="relative group hover:bg-gradient-to-r hover:from-gray-300 hover:to-gray-100 hover:to-gray-100 hover:scale-105 block bg-white flex justify-between rounded-md group shadow-lg px-0 mb-2 py-2 ">
                <span class="absolute left-0 top-0 h-full  rounded-md bg-gradient-to-r group-hover:from-blue-600 group-hover:to-blue-200 from-blue-500 to-blue-100" style="width: ${width};"></span>
                <span class="px-2 z-10  text-sm text-gray-700 text-shadow    opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  ${width}
                </span>
                <span class=" z-10 inline-block w-full  text-right group-hover:font-semibold text-gray-500 px-2">${label}</span>
              </span>
            `;
        });
        return `<td class="px-4 py-2 text-center">${displayArr.length ? displayArr.join('') : '-'}</td>`;
      }).join("")}
    </tr>`;
  });
  html += `</tbody>`;

  // 渲染到你的 table 元素
  document.getElementById('topTechStackTable').innerHTML = html;
}

function capitalize(str) {
  if (!str) return "";
  // Capitalize the first letter of the string
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ========================================================================
// tech stack rankings by company
// ========================================================================

// renderCompanies.js
// this function combines data fetching and rendering logic for the tech stack rankigns by company section
// it fetches the ranking data and job counts, processes them and then renders the company cards
export async function renderTechStackByCompany(companyLimit = 20) {

  // build the API URL with query parameters
  const url = new URL(`${window.API_BASE}/api/rankings/by-company`, window.location.origin);   
  url.searchParams.set('companyLimit', String(companyLimit));
  // get the ranking data by company, used for rendering the company card
  const res = await fetch(url.toString());
  const rows = await res.json();
  // get the job counts by company, used for sorting the company cards and rendering card header
  const cntRes       = await fetch(`${window.API_BASE}/api/stats/jobs/company`);
  const cntRows      = await cntRes.json();
  // both approaches create the same jobsCountMap, but the second one (below) is much easier to understand
  // const jobsCountMap = cntRows.reduce((m, x) => (m[x.company_Id] = x.jobs_Count, m), {});
  const jobsCountMap = {};
  for (const row of cntRows) {
    jobsCountMap[row.company_Id] = row.jobs_Count;
  }

  const byCompany = {};
  rows.forEach(r => {
    // createa a company object grouped by company_Id, each company object contains its id, name, and categories 
    byCompany[r.company_Id] ??= {
      id:   r.company_Id,
      name: r.company_Name,
      cats: {}
    };
    // then, for each row, add its technology and percentage to the corresponding category array
    const cats = byCompany[r.company_Id].cats;
    (cats[r.category] ??= []).push({
      technology: r.technology,
      percentage: r.percentage
    });
  });

  const container = document.getElementById('companiesContainer');
  const frag = document.createDocumentFragment();
  Object.values(byCompany)
    .sort((a, b) => (jobsCountMap[b.id] || 0) - (jobsCountMap[a.id] || 0))
    .forEach(comp => {
      const outer = document.createElement('div');
      // the outer div is used for fade-in animation
      outer.className = 'opacity-0 js-fade-in-companies-card '; 

      const card = document.createElement('div');
      card.dataset.companyId = comp.id;
      card.className = 'flex flex-col gap-6 bg-gradient-to-r from-gray-200 to-white p-8 rounded-xl shadow-lg transform transition-transform duration-300  hover:bg-gradient-to-r hover:from-blue-300 hover:to-white hover:scale-105';

      outer.appendChild(card); 
      card.dataset.companyId = comp.id;

      const jc = jobsCountMap[comp.id] || 0;

      card.insertAdjacentHTML('beforeend', `
        <div class="">
          <p class="text-xl font-bold text-blue-600 truncate">${comp.name}</p>
          <p class="text-sm text-gray-600">${jc} Job Postings</p>
        </div>
    `);

    frag.appendChild(outer);

    // render each category in predefined order
    ['Frontend','Backend','Cloud Platforms','Database'].forEach(cat => {
      const arr = (comp.cats[cat] || []).slice(0, 3);

      const colHtml = arr.map((item, idx) => {
        const techName = item.technology.charAt(0).toUpperCase() + item.technology.slice(1);
        const percentage = (item.percentage * 100).toFixed(2) + '%';
        return `
          <span class="relative block bg-white rounded-md shadow-lg px-0 mb-2 py-2 overflow-hidden min-w-[120px] w-full">
            <span class="absolute left-0 top-0 h-full rounded-md bg-gradient-to-r from-blue-500 to-blue-200" style="width: ${percentage};"></span>
            <span class="relative  z-10 text-gray-500 text-sm inline-block w-full text-right px-2" style="white-space:nowrap;">
              ${techName}
            </span>
          </span>
        `;
      }).join('');

      const col = document.createElement('div');
      col.className = 'flex flex-col gap-0 h-[150px] min-w-[150px] text-gray-500 items-center text-center justify-center w-full';
      col.innerHTML = colHtml;

      card.append(col);
    });


  });
  container.appendChild(frag);
  // initialize the fade-in animation for company cards after they are rendered
  initCompanyCardFadeInOnView(); 

}

// ========================================================================
// helper functions
// ========================================================================

function updateJobCount() {
  fetch(`${window.API_BASE}/api/stats/jobs/count`)
    .then(res => res.json())
    .then(data => {
      document.getElementById("job-count").textContent = data.count+" job posts";
      document.getElementById("job-count-2").textContent = data.count+" job posts";
      document.getElementById("job-count-3").textContent = data.count+" job posts";
      document.getElementById("job-count-4").textContent = data.count+" job posts";
    })
    .catch(err => console.error("Job count fetch failed:", err));
}

// there are two animation functions in this file, both of them handle fade-in animation but for different components
// to be specific, the initFadeInOnView function handles general fade-in animation such as those used in the tech stack ranking by category and by level section
// and the initCompanyCardFadeInOnView function specifically handles the fade-in animation for the company cards in the tech stack ranking by company section
// the main difference: initFadeInOnView works on static DOM elements that are already present when the page loads, while initCompanyCardFadeInOnView works on dynamically generated elements
// so the trigger for these two functions are different, the initFadeInOnView is triggered when the page load, while the initCompanyCardFadeInOnView is triggered after the company cards are rendered
// The animation for the company cards is different from the others — the cards fade in one by one, while the other components fade in all at once
function initFadeInOnView() {
  // create an observer instance to monitor elements entering the viewport
  // when an element enters the viewport, the callback function is triggered, it removes the opacity-0 class and adds the animate-fade-up class to trigger the fade-in animation
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.remove('opacity-0');
        entry.target.classList.add('animate-fade-up');
        observer.unobserve(entry.target); // 播放一次就不再监听
      }
    });
  }, {
    threshold: 0.3  // trigger when 30% of the element is visible
  });

  // observe all elements with the .js-fade-in class
  // kind of like adding event listeners to multiple elements
  document.querySelectorAll('.js-fade-in').forEach(el => {
    observer.observe(el);
  });
}

function initCompanyCardFadeInOnView() {
  // get all company cards and convert the NodeList to an array
  const cards = Array.from(document.querySelectorAll('.js-fade-in-companies-card'));
  // define the trigger element for the observer
  const trigger = document.getElementById('companySectionTitle');
  // create an observer instance to monitor when the trigger element enters the viewport
  const observer = new IntersectionObserver((entries, obs) => {
    // if any of the entries are intersecting (visible in viewport)
    if (entries.some(entry => entry.isIntersecting)) {
      // immediately show the first card, then show each subsequent card with a 400ms delay
      cards.forEach((el, idx) => {
        setTimeout(() => {
          el.classList.remove('opacity-0');
          el.classList.add('opacity-100', 'animate-fade-up');
        }, idx * 400);
      });
      // stop observing after the animation is triggered
      obs.disconnect();
    }
  }, { threshold: 0 }); // trigger when just a little bit is visible
  
  observer.observe(trigger);
}

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

// ========================================================================
// functions are not used currently
// ========================================================================

async function drawExperiencePie() {
  // 1. 请求后端接口
  const res  = await fetch(`${window.API_BASE}/api/count/by-level`);
  const data = await res.json();

  // 2. 准备标签和数据
  level_labels   = data.map(d => d.level);
  const percents = data.map(d => d.percentage);

  // 3. 绘制饼图
  const ctx = document.getElementById('experiencePie').getContext('2d');

  if (experienceChart) {
    experienceChart.destroy();
  }

  experienceChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: level_labels,
      datasets: [{
        data: percents,
        backgroundColor: [
          '#60a5fa', // Senior
          '#93c5fd', // Intermediate
          '#bfdbfe', // Junior
          '#e5e7eb'  // Other
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      elements: {
        arc: {
          offset: ctx => ctx.dataIndex === selectedIndex ? 80 : 0
        }
      },
      layout: {
        padding: { left: 0, right: 120, top: 1, bottom: 20 }
      },

      plugins: {
        title: {
          display: true,
          text: 'Job Distribution by Experience Level',
          font: {
            size: 20,
            weight: 'normal' 
          },
          padding: {
            top: 10,
            bottom: 20
          }
        },
        // legend: {
        //   display: true,
        //   position: 'bottom',
        //   labels: {
        //     generateLabels: chart => {
        //       const d  = chart.data;
        //       const ds = d.datasets[0];
        //       return d.labels.map((lab,i) => ({
        //         text: `${lab}: ${ds.data[i].toFixed(2)}%`,
        //         fillStyle:   ds.backgroundColor[i],
        //         strokeStyle: ds.backgroundColor[i],
        //         hidden:      chart.getDataVisibility(i) === false,
        //         index:       i
        //       }));
        //     }
        //   }
        // },
        legend: {
          display: false
        },
        datalabels: {
        // 只显示 Senior、Intermediate、Junior 三个
        display: ctx => {
          const lab = ctx.chart.data.labels[ctx.dataIndex];
          return ['Senior', 'Intermediate', 'Junior'].includes(lab);
        },

        // 文案：标签 + 百分比
        formatter: (value, ctx) => {
          const label = ctx.chart.data.labels[ctx.dataIndex];
          return `${label} : ${value.toFixed(2)}%`;
        },

        color: ctx => ctx.dataIndex === selectedIndex ? '#000' : '#000',
        // font: {
        //   size: 16,
        //   weight: 'normal'
        // },
        font: ctx => ctx.dataIndex === selectedIndex
        ? { size: 18, weight: 'bold' }
        : { size: 16, weight: 'normal' },
        
        stroke: '#fff',           // 白色描边
        strokeWidth: 4, 

        // 放在扇区中心
        anchor: 'end',
        align:  'end',
        offset: 5,

        clip:  false,
        clamp: false
      },
        
        // datalabels: {
        //   display: false,
        // },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.parsed.toFixed(2)}%`
          }
        }
      }
    }
  });
}

function renderLevelOptions() {
  const container = document.getElementById('experienceLevel');
  if (!container) return;

  container.innerHTML = levelCounts
    .map(({ level, count }) => {
      const val   = level.toLowerCase();
      const label = level.charAt(0).toUpperCase() + level.slice(1);
      return `
        <button
          class="level-filter-btn bg-gray-200 text-gray-700 px-2 py-1 mt-1 rounded-md hover:bg-blue-400 hover:text-white text-sm"
          data-filter="${val}"
        >
          ${label} (${count})
        </button>
      `;
    })
    .join('');

  const allBtn = container.querySelector('button.level-filter-btn[data-filter="all"]');
  if (allBtn) {
    // 高亮样式
    allBtn.classList.remove('bg-gray-200','text-gray-700');
    allBtn.classList.add('bg-blue-500','text-white');
    // 如果你想让它立刻拉取并渲染 all 的数据，可以模拟一次点击：
    allBtn.click();
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
