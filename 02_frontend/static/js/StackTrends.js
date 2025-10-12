// import { mockData } from './mockData.js';
const API_BASE = window.API_BASE;
let topChart;
let experienceChart = null;
let selectedIndex = -1;
let level_labels = [];

function initChart(labels, data) {
  topChart?.destroy(); // 避免多次渲染冲突

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

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && topChart) {
    // 重置动画状态并立即重绘（无动画）
    topChart.reset();
    topChart.update({ duration: 0 });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // populateTable(mockData);
  loadTechRank(); // Load the tech table data
  updateJobCount();
  drawExperiencePie();
  fetchLevelCounts()
    .then(() => {
      renderTopTechStackTableByLevel();
    })
    .catch(err => console.error(err));
  renderTechStackByCompany('companiesContainer', `${window.API_BASE}/api/companies/tech-stack-rank`, 20);
});

// window.addEventListener('resize', syncChartHeight);

// function syncChartHeight() {
//   const tableBox = document.querySelector('.right-table-box');  // ③ 找到右侧表格的“外层div”，给它起个class
//   const chartBox = document.querySelector('.left-chart-box');  // ④ 找到左侧柱状图的“外层div”，也给它起个class

//   if(tableBox && chartBox) { // ⑤ 只要两个都找到了
//     chartBox.style.height = tableBox.offsetHeight + 'px'; // ⑥ 就让左边div的高度=右边div的实际高度
//   }
// }

document.addEventListener('click', function (event) {
  if (event.target.classList.contains('filter-btn')) {
    const filterValue = event.target.getAttribute('data-filter').toLowerCase();
    filterTable(filterValue, event.target);
  }
});


function filterTable(filterValue,clickedButton) {  
  let filteredData;
  if (filterValue === 'all') {
    renderTechTableRows(allLevelData);
    filteredData = allLevelData; // 全部数据
    // showMoreBtn.style.display = allData.length > 20 ? '' : 'none';
  }else {
    renderTechTableRows(allLevelData); // 先渲染全部数据
    const rows = document.querySelectorAll('#techTable tr');
    // showMoreBtn.style.display = 'none'; // 隐藏“显示更多”按钮
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

  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.remove('bg-blue-500','text-white');
    b.classList.add('bg-gray-200','text-gray-700');
  });

  // —— 再去掉当前按钮的灰底灰字，加上高亮 ——  
  clickedButton.classList.remove('bg-gray-200','text-gray-700');
  clickedButton.classList.add('bg-blue-500','text-white');
}

let allLevelData = []; // level=all 的数据
let allData = []; // 全部数据

async function loadTechRank() {
  try {
    const response = await fetch(`${window.API_BASE}/api/count/tech-stacks`);
    allData = await response.json();

    allLevelData = allData
      .filter(item => (item.level ?? item.Level)?.toLowerCase() === 'all')
      .sort((a, b) =>
        (b.percentage ?? b.Percentage) - (a.percentage ?? a.Percentage)
      );
    renderTechTableRows(allLevelData);
    renderCategoryTags(allLevelData);


    // const clickedButton = document.querySelector('.filter-btn[data-filter="all"]');
    // clickedButton.classList.remove('bg-gray-200','text-gray-700');
    // clickedButton.classList.add('bg-blue-500','text-white');
    // const showMoreBtn = document.getElementById('showMoreBtn');
    // showMoreBtn.style.display = data.length > 20 ? '' : 'none';

    //  if (!showMoreBtn.hasListener) {
    //   showMoreBtn.addEventListener('click', () => {
    //     renderTechTableRows(allData); // 全部渲染
    //     showMoreBtn.style.display = 'none'; // 隐藏按钮
    //   });
    //   showMoreBtn.hasListener = true; // 避免重复绑定
    // }

    // const tbody = document.getElementById('techTable');
    // tbody.innerHTML = ''; // Clear previous rows

    const top10= allLevelData.slice(0, 10); // Get top 10 items
    let labels = top10.map(item => item.technology ?? item.Technology);
    labels = labels.map(label => label.charAt(0).toUpperCase() + label.slice(1));
    const counts = top10.map(item => item.percentage ?? item.Percentage);

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

// async function loadCategoryOptions() {
//     const categories = document.getElementById('category-filters');
//     categories.innerHTML = '';

//     const allBtn = document.createElement('button');
//     allBtn.className = 'filter-btn bg-gray-200 text-gray-700 px-2 py-1 mt-0 rounded-md hover:bg-blue-400 hover:text-white text-sm';
//     allBtn.dataset.filter = 'all';
//     allBtn.textContent = 'All';
//     categories.appendChild(allBtn);


//     const res = await fetch(`${API_BASE}/api/category`);
//     const cats = await res.json();
//     cats.forEach(c => {
//       const btn = document.createElement('button');
//       btn.className = 'filter-btn bg-gray-200 text-gray-700 px-2 py-1 mt-0 rounded-md hover:bg-blue-400 hover:text-white text-sm';
//       btn.dataset.filter = c.name;
//       btn.textContent = c.name;
//       categories.appendChild(btn);
//     });

//     if (allBtn) {
//       allBtn.classList.remove('bg-gray-200', 'text-gray-700');
//       allBtn.classList.add('bg-blue-500', 'text-white');
//       allBtn.click();
//     }
// }

async function loadCategoryOptions() {
  const root = document.getElementById('category-filters');
  root.innerHTML = '';

  // 触发按钮容器
  const trigger = document.createElement('div');
  trigger.className =
    'flex items-center justify-between px-8 py-2 text-lg text-gray-600 rounded-lg cursor-pointer bg-white   ';
  
  // 左侧文字
  const triggerLabel = document.createElement('span');
  triggerLabel.textContent = 'All';

  // 右侧 SVG 图标
  const triggerIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  triggerIcon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  triggerIcon.setAttribute('fill', 'none');
  triggerIcon.setAttribute('viewBox', '0 0 24 24');
  triggerIcon.setAttribute('stroke-width', '1.5');
  triggerIcon.setAttribute('stroke', 'currentColor');
  triggerIcon.classList.add('w-5', 'h-5');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('d', 'm19.5 8.25-7.5 7.5-7.5-7.5');
  triggerIcon.appendChild(path);

  trigger.appendChild(triggerLabel);
  trigger.appendChild(triggerIcon);

  // 下拉容器
  const menu = document.createElement('div');
  menu.className =
    'absolute right-0 mt-2 w-60 p-4 flex flex-col gap-y-2 bg-white rounded-xl shadow-xl hidden flex flex-col z-40';

  // 工厂函数：生成按钮
  const makeBtn = (label) => {
    const btn = document.createElement('button');
    btn.className =
      'filter-btn bg-white text-left rounded-lg px-3 py-1 text-lg hover:bg-blue-100';
    btn.dataset.filter = label;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      triggerLabel.textContent = label;  // 改变显示文字
      menu.classList.add('hidden');      // 收起菜单
    });
    return btn;
  };

  // 默认 All
  const allBtn = makeBtn('All');
  menu.appendChild(allBtn);

  // 获取分类
  const res = await fetch(`${API_BASE}/api/category`);
  const cats = await res.json();
  cats.forEach(c => {
    menu.appendChild(makeBtn(c.name));
  });

  // 切换展开/收起
  trigger.addEventListener('click', (e) => {
    e.stopPropagation(); // 阻止冒泡，避免点 trigger 就直接触发全局关闭
    menu.classList.toggle('hidden');
  });

  root.appendChild(trigger);
  root.appendChild(menu);

  // 默认触发一次 All
  allBtn.click();

  // 点击外部收起
  document.addEventListener('click', (e) => {
    if (!trigger.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });

}


function renderTechTableRows(data, limit) {
  const tbody = document.getElementById('techTable');
  tbody.innerHTML = '';
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

// function populateTable(data) {
//   const tableBody = document.getElementById('techTable');
//   tableBody.innerHTML = ''; // Clear existing rows

//   data.forEach(row => {
//     const tr = document.createElement('tr');
//     tr.className = 'bg-white hover:bg-gray-100';

//     tr.innerHTML = `
//       <td class="border px-4 py-2">${row.technology}</td>
//       <td class="border px-4 py-2">${row.category}</td>
//       <td class="border px-4 py-2">${row.mentions}</td>
//       <td class="border px-4 py-2">${row.percentage}</td>
//       <td class="border px-4 py-2"><a href="" class='text-sm text-blue-500 underline'>Related Jobs>></a></td>

//     `;

//     tableBody.appendChild(tr);
//   });
// }

function renderCategoryTags(data) {
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

  // 分组
  const grouped = {};
  data.forEach(item => {
    const category = item.category ?? item.Category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
  });

  // 遍历每个大类，单独填充到各自的div里
  categoryOrder.forEach(cat => {
    const techList = (grouped[cat] || [])
      .sort((a, b) => (b.mentions ?? b.Mentions) - (a.mentions ?? a.Mentions))
      .slice(0, 5); // 可调整显示数量

    // 找到前端对应的div
    const container = document.getElementById(cat);
    if (!container) return;

    let html = "";
    const bgArr = [
      'blue-900', // ≥ 0.30
      'blue-700', // 0.30 - 0.25
      'blue-500', // 0.25 - 0.20
      'blue-300'  // 0.20 - 0.15

    ];
    techList.forEach((item, idx) => {
      const rawName = item.technology ?? item.Technology;
      const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      const percentageRaw = item.percentage ?? item.Percentage;
      const percentage = (percentageRaw * 100).toFixed(2) + '%';
      const percentageWidth = percentage;

      let bgClass = '';
      if (percentageRaw >= 0.30) {
        bgClass = bgArr[0];
      } else if (percentageRaw >= 0.20) {
        bgClass = bgArr[1];
      } else if (percentageRaw >= 0.10) {
        bgClass = bgArr[2];
      } else {
        bgClass = bgArr[3] + ''; 
      }

      let textClass = '';
      if (percentageRaw >= 0.05) {
        textClass = 'text-white ';
      } else {
        textClass = 'text-white';
      }

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

    initFadeInOnView();

  });

}

// <div class="py-4 w-full rounded-lg opacity-0 js-fade-in bg-gradient-to-r shadow-lg flex flex-col items-center justify-center  from-${bgClass} to-white ${textClass}">
//   <span class="block text-center w-full truncate text-md font-semibold " title="${name}">${name}</span>
//   <div class="text-sm mt-1">${percentage}</div>
// </div>

// ${idx === 0 ? `<span class="ml-2 text-sm text-gray-500">(${percentage})</span>` : ''}


function updateJobCount() {
  fetch(`${window.API_BASE}/api/job/count`)
    .then(res => res.json())
    .then(data => {
      document.getElementById("job-count").textContent = data.count+" job posts";
      document.getElementById("job-count-2").textContent = data.count+" job posts";
      document.getElementById("job-count-3").textContent = data.count+" job posts";
      document.getElementById("job-count-4").textContent = data.count+" job posts";


    })
    .catch(err => console.error("Job count fetch failed:", err));
}

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


// function populateLevelDropdown(selectorId) {
//   const levels = ['all', 'Senior', 'Intermediate', 'Junior', 'Other'];
//   const sel = document.getElementById(selectorId);
//   sel.innerHTML = levels
//     .map(l => `<option value="${l.toLowerCase()}">${l} Level</option>`)
//     .join('');
// }

let levelCounts = [];

// 1) 用 .then() 代替 async/await
function fetchLevelCounts() {

  return fetch(`${API_BASE}/api/job/count/by-level`)

    .then(resp => {
      if (!resp.ok) throw new Error('请求失败 ' + resp.status);
      return resp.json();
    })
    .then(json => {
      levelCounts = json;
    })
    .catch(err => {
      console.error(err);
    });
}

// 2) 渲染 <select>
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

    // container.addEventListener('click', async function(e) {

    //     const btn = e.target.closest('button.level-filter-btn');
    //     if (!btn) return;            // 不是我们关心的按钮就忽略

    //   container.querySelectorAll('.level-filter-btn').forEach(b => {
    //     b.classList.remove('bg-blue-500','text-white');
    //     b.classList.add('bg-gray-200','text-gray-700');
    //   });

    //   // —— 再给当前按钮加上“选中”高亮 —— 
    //   btn.classList.remove('bg-gray-200','text-gray-700');
    //   btn.classList.add('bg-blue-500','text-white');

    //   const selectedLevel = btn.dataset.filter;  // 拿 data-filter

    //   const label = selectedLevel.charAt(0).toUpperCase() + selectedLevel.slice(1);
    //   const span = document.getElementById('jobLevel');
    //   if (span) span.textContent = label;

    //   selectedIndex = level_labels.findIndex(lab => lab.toLowerCase() === selectedLevel); // 这行
    //   if (experienceChart) {
    //     experienceChart.update();
    //   }

    //   try {
    //     const res = await fetch(`https://stacktrends-api-cshjb2ephxbjdffa.newzealandnorth-01.azurewebsites.net/api/count/tech-stacks?level=${selectedLevel}`);
    //     if (!res.ok) throw new Error(res.status);
    //     const data = await res.json();
    //     renderCategoryTags( data.filter(item =>
    //       (item.level ?? item.Level).toLowerCase() === selectedLevel
    //     ));
    //   } catch (err) {
    //     console.error('Failed to fetch tech stacks:', err);
    //   }

    // });


  const allBtn = container.querySelector('button.level-filter-btn[data-filter="all"]');
  if (allBtn) {
    // 高亮样式
    allBtn.classList.remove('bg-gray-200','text-gray-700');
    allBtn.classList.add('bg-blue-500','text-white');
    // 如果你想让它立刻拉取并渲染 all 的数据，可以模拟一次点击：
    allBtn.click();
  }

}



document.addEventListener('DOMContentLoaded', loadCategoryOptions);

async function renderTopTechStackTableByLevel() {
  const levels = [
    { key: "junior",        label: "🧑‍🎓 Junior&Graduate" },
    { key: "intermediate",  label: "👨‍💻 Intermediate"    },
    { key: "senior",        label: "👨‍💼 Senior"          }
  ];

  // 并发请求三个 level 的数据
  const responses = await Promise.all(
    levels.map(lvl =>
      fetch(`${window.API_BASE}/api/count/tech-stacks?level=${lvl.key}`)
        .then(res => res.json())
    )
  );

  // 数据结构处理：{category: {junior: [tech1,tech2,tech3], intermediate: [...], ...}}
  const tableData = {};
  levels.forEach((lvl, idx) => {
    const arr = responses[idx];
    // 对每个 category 只取 mentions 前3的 technology
    const grouped = {};
    arr.forEach(item => {
      const cat  = item.category   ?? item.Category;
      const tech = item.technology ?? item.Technology;
      const ment = item.mentions   ?? item.Mentions;
      if (!grouped[cat]) grouped[cat] = [];
      const perc = item.percentage ?? item.Percentage;
      grouped[cat].push({ tech, ment, perc });

    });
    // 只保留 mentions 前3
    Object.entries(grouped).forEach(([cat, arr2]) => {
    const top3 = arr2
      .sort((a, b) => b.ment - a.ment)
      .slice(0, 3);
      if (!tableData[cat]) tableData[cat] = {};
      tableData[cat][lvl.key] = top3;
    });
  });

  // 按照固定顺序展示
  const categoryOrder = [
    "Frontend","Backend","Coding Methods and Practices","Cloud Platforms",
    "DevOps Tools","Database","AI"
  ];

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
  categoryOrder.forEach(cat => {
    html += `<tr class="">
      <td class="px-4 py-2">
        <div class="relative w-16 h-16 flex items-center justify-center ">
          <span class="relative text-lg font-bold text-gray-600 z-10">${cat}</span>
          <span class="absolute inset-0 bg-gray-200 rounded-full"></span>
        </div>

      </td>
      ${levels.map(lvl => {
        const arr = tableData[cat]?.[lvl.key] || [];
        // const displayArr = arr.map((val, idx) => 
        //   idx === 0 
        //     ? `<span class="font-bold bg-blue-400 w-full inline-block shadow-lg rounded-lg px-2 py-1 text-white">${capitalize(val)}</span>`
        //     : capitalize(val)
        // );*/
        const displayArr = arr.map((val, idx) => {
          // val 现在应该是对象 { tech, ment, perc }
          // if (idx === 0) {
            const width = `${(val.perc * 100).toFixed(2)}%`;
            const label = `${capitalize(val.tech)}`;            
              // const label = `${capitalize(val.tech)}`;

            return `
              <span class="relative group hover:bg-gradient-to-r hover:from-gray-300 hover:to-gray-100 hover:to-gray-100 hover:scale-105 block bg-white flex justify-between rounded-md group shadow-lg px-0 mb-2 py-2 ">
                <span class="absolute left-0 top-0 h-full  rounded-md bg-gradient-to-r group-hover:from-blue-600 group-hover:to-blue-200 from-blue-500 to-blue-100" style="width: ${width};"></span>
                <span class="px-2 z-10  text-sm text-gray-700 text-shadow    opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  ${width}
                </span>
                <span class=" z-10 inline-block w-full  text-right group-hover:font-semibold text-gray-500 px-2">${label}</span>
              </span>
            `;
          // } else {
          //   // 其他普通文字
          //   return `${capitalize(val.tech)} (${(val.perc * 100).toFixed(2)}%)`;
          // }
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
  return str.charAt(0).toUpperCase() + str.slice(1);
}

document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("menu-toggle");
  const menu = document.getElementById("menu");

  toggleBtn.addEventListener("click", () => {
    menu.classList.toggle("hidden");
  });
});

function initFadeInOnView() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.remove('opacity-0');
        entry.target.classList.add('animate-fade-up');
        observer.unobserve(entry.target); // 播放一次就不再监听
      }
    });
  }, {
    threshold: 0.3  // 进入 30% 就触发
  });

  document.querySelectorAll('.js-fade-in').forEach(el => {
    observer.observe(el);
  });
}

// renderCompanies.js
export async function renderTechStackByCompany(containerId, apiUrl, companyLimit = 20) {
  // 1. 拉数据
  // const res  = await fetch(apiUrl);
  const url = new URL(apiUrl, window.location.origin);   // 兼容相对/绝对地址
  url.searchParams.set('companyLimit', String(companyLimit));
  const res = await fetch(url.toString());
  const rows = await res.json();

  const cntRes       = await fetch(`${window.API_BASE}/api/companies/jobs-count`);
  const cntRows      = await cntRes.json();
  const jobsCountMap = cntRows.reduce((m, x) => (m[x.company_Id] = x.jobs_Count, m), {});

  // 2. 按 company 分组
  const byCompany = {};
  rows.forEach(r => {
    byCompany[r.company_Id] ??= {
      id:   r.company_Id,
      name: r.company_Name,
      cats: {}
    };
    const cats = byCompany[r.company_Id].cats;
    // (cats[r.category] ??= []).push(r.technology);
    (cats[r.category] ??= []).push({
      technology: r.technology,
      percentage: r.percentage
    });
  });

  // 3. 渲染到容器
  const container = document.getElementById(containerId);
  const frag = document.createDocumentFragment();
  // Object.values(byCompany).forEach(comp => {
  Object.values(byCompany)
    .sort((a, b) => (jobsCountMap[b.id] || 0) - (jobsCountMap[a.id] || 0))
    .forEach(comp => {
      const outer = document.createElement('div');
      outer.className = 'opacity-0 js-fade-in'; // 外层负责 fadeUp 动画

      const card = document.createElement('div');
      card.dataset.companyId = comp.id;
      card.className = 'flex flex-col gap-6 bg-gradient-to-r from-gray-200 to-white p-8 rounded-xl shadow-lg transform transition-transform duration-300 hover:scale-105 hover:bg-gradient-to-r hover:from-blue-300 hover:to-white';

      outer.appendChild(card); // 把 card 放进外壳
      // 公司名
      // 先设置 data-id
      card.dataset.companyId = comp.id;

      // 计算职位数
      const jc = jobsCountMap[comp.id] || 0;

      // 直接插入 HTML
      card.insertAdjacentHTML('beforeend', `
        <div class="">
          <p class="text-xl font-bold text-blue-600 truncate">${comp.name}</p>
          <p class="text-sm text-gray-600">${jc} Job Postings</p>
        </div>
    `);

    frag.appendChild(card);


    // 按固定顺序渲染 4 个分类，每组取前三
    ['Frontend','Backend','Cloud Platforms','Database'].forEach(cat => {
      const arr = (comp.cats[cat] || []).slice(0, 3);

      // 拼接每个技术的进度条段落
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
  initCompanyCardFadeInOnView(); // 只在最后调用一次
}

function initCompanyCardFadeInOnView() {
  const cards = Array.from(document.querySelectorAll('.js-fade-in'));
  const trigger = document.getElementById('companySectionTitle');
  const observer = new IntersectionObserver((entries, obs) => {
    if (entries.some(entry => entry.isIntersecting)) {
      // 立即显示第一张，其余每张间隔20ms（可调整到你觉得顺滑为止）
      cards.forEach((el, idx) => {
        setTimeout(() => {
          el.classList.remove('opacity-0');
          el.classList.add('opacity-100', 'animate-fade-up');
        }, idx * 50);
      });
      obs.disconnect();
    }
  }, { threshold: 0 }); // 只要一点点进入就触发

  observer.observe(trigger);
}

// function initParticles() {
//   tsParticles.load("tsparticles", {
//     background: {
//       color: { value: "transparent" }
//     },
//     particles: {
//       number: { value: 80 },
//       color: { value: "#6B7280" },
//       shape: { type: "circle" },
//       opacity: { value: 0.5 },
//       size: { value: 3 },
//       move: { enable: true, speed: 1 },
//       links: {
//         enable: true,
//         distance: 150,
//         color: "#9CA3AF",
//         opacity: 0.4,
//         width: 1
//       }
//     },
//     fullScreen: { enable: false }
//   });
// }

// document.addEventListener("DOMContentLoaded", function () {
//   initParticles();
// });
// async function fetchTechTrends() {
//   try {
//     const response = await fetch(`${window.API_BASE}/api/count/tech-trends`); // 根据你的后端路由调整
//     const data = await response.json();

//     // 分组 growing / declining
//     const growing = data.filter(d => d.trendType === "growing");
//     const declining = data.filter(d => d.trendType === "declining");

//     // 按 technology 分组
//     const groupByTech = (arr) => {
//       const map = {};
//       arr.forEach(item => {
//         if (!map[item.technology]) map[item.technology] = [];
//         map[item.technology].push({ month: item.month, percentage: item.percentage });
//       });
//       // 按月份排序
//       for (const tech in map) {
//         map[tech].sort((a, b) => new Date(a.month) - new Date(b.month));
//       }
//       return map;
//     };

//     const growingMap = groupByTech(growing);
//     const decliningMap = groupByTech(declining);

//     // 选出变化量最大的前 5
//     function pickTop5(datasetsMap, isGrowing = true) {
//       const diffs = Object.entries(datasetsMap).map(([tech, values]) => {
//         const first = values[0]?.percentage ?? 0;
//         const last = values[values.length - 1]?.percentage ?? 0;
//         return { tech, diff: last - first };
//       });
//       // 排序
//       const sorted = diffs.sort((a, b) => b.diff - a.diff);
//       const top5 = isGrowing ? sorted.slice(0,3) : sorted.slice(-3);

//       const picked = {};
//       top5.forEach(({ tech }) => {
//         picked[tech] = datasetsMap[tech];
//       });
//       return picked;
//     }

//     const growingTop5 = pickTop5(growingMap, true);
//     const decliningTop5 = pickTop5(decliningMap, false);

//     // 画图函数
//     function drawChart(containerId, title, datasetsMap) {
//       // 清空容器
//       const container = document.getElementById(containerId);
//       container.innerHTML = '<canvas></canvas>';
//       const ctx = container.querySelector("canvas").getContext("2d");

//       const labels = [...new Set(Object.values(datasetsMap).flat().map(d => d.month))]
//         .sort((a, b) => new Date(a) - new Date(b));

//       const datasets = Object.entries(datasetsMap).map(([tech, values]) => ({
//         label: tech,
//         data: labels.map(m => {
//           const found = values.find(v => v.month === m);
//           return found ? found.percentage : null;
//         }),
//         borderWidth: 2,
//         fill: false,
//         tension: 0.2
//       }));

//       new Chart(ctx, {
//         type: "line",
//         data: { labels, datasets },
//         options: {
//           responsive: true,
//           plugins: {
//             title: {
//               display: false,
//               text: title
//             },
//             legend: {
//               display: false   // 去掉图例
//             },
//             datalabels: {
//               display: false   // 去掉折线上数字
//             },
//             tooltip: {
//               callbacks: {
//                 label: function(context) {
//                   const value = context.parsed.y;
//                   return (value * 100).toFixed(2) + "%";
//                 }
//               }
//             }
//           },
//           interaction: {
//             mode: "index",
//             intersect: false
//           },
//           scales: {
//             y: {
//               beginAtZero: false,
//               title: { display: false, text: "Mention Rate" },
//               grid: {
//                 display: false   // 🚀 关闭 Y 轴网格
//               },
//               ticks: {
//                   display: false   // 🚀 去掉 Y 轴刻度文字
//               },
//               border: {
//                 display: false   // 🚀 去掉 Y 轴整条坐标轴线
//               }
//             },
//             x: {
//               title: { display: false, text: "Month" },
//               grid: {
//                 display: false   // 🚀 关闭 X 轴网格
//               },
//               border: {
//                 display: false   // 🚀 去掉 Y 轴整条坐标轴线
//               }
//             }
//           }
//         },
//         plugins: [
//           {
//             id: "lineLabels",
//             afterDatasetsDraw(chart) {
//               const { ctx } = chart;
//               chart.data.datasets.forEach((dataset, datasetIndex) => {
//                 const meta = chart.getDatasetMeta(datasetIndex);
//                 if (!meta.hidden) {
//                   const lastPoint = meta.data[meta.data.length - 1];
//                   if (lastPoint) {
//                     const { x, y } = lastPoint.getProps(["x", "y"], true);
//                     ctx.save();
//                     ctx.fillStyle = dataset.borderColor || "black";
//                     ctx.font = "13px sans-serif";
//                     ctx.textAlign = "left";
//                     ctx.textBaseline = "middle";
//                     ctx.fillText(dataset.label, x-40, y-16); // 🚀 在最后一个点右边画名字
//                     ctx.restore();
//                   }
//                 }
//               });
//             }
//           }
//         ]
//       }

//     );
//     }

//     // 绘制两张图 (只取变化量最大的 top5)
//     drawChart("fastest-growing-skills", "Top Growing Skills", growingTop5);
//     drawChart("declining-skills", "Top Declining Skills", decliningTop5);

//   } catch (err) {
//     console.error("Failed to fetch tech trends:", err);
//   }
// }

// // 页面加载完毕调用
// document.addEventListener("DOMContentLoaded", fetchTechTrends);
