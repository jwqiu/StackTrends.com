// import { mockData } from './mockData.js';

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
        categoryPercentage: 0.8, // 每个分类格子本身占用可用空间的90%
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
        padding: {top: 0, bottom: 0} // 让内容紧贴上边
      },
      scales: {
        y: {
          beginAtZero: true,  // 关闭自动从0开始
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
            drawTicks: false
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
            color: '#4b5563'
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
          display: true,
          text: 'Share of jobs mentioning this tech stack',
          font: { size: 20, weight: 'normal' },
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
          }
        }
      },
      elements: {
        bar: {
          borderRadius: 6, // ✅ 圆角柱状条
          borderSkipped: false,
          barThickness: barThickness // 控制柱子宽度
        }
      }
    }
  });

}


document.addEventListener('DOMContentLoaded', () => {
  // populateTable(mockData);
  loadTechRank(); // Load the tech table data
  updateJobCount();
  drawExperiencePie();
  fetchLevelCounts()
    .then(() => {
      renderLevelOptions();
    })
    .catch(err => console.error(err));
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
    const response = await fetch('https://stacktrends-api-cshjb2ephxbjdffa.newzealandnorth-01.azurewebsites.net/api/count/tech-stacks');
    allData = await response.json();

    allLevelData = allData
      .filter(item => (item.level ?? item.Level)?.toLowerCase() === 'all')
      .sort((a, b) =>
        (b.percentage ?? b.Percentage) - (a.percentage ?? a.Percentage)
      );
    renderTechTableRows(allLevelData);
    renderCategoryTags(allLevelData);


    const clickedButton = document.querySelector('.filter-btn[data-filter="all"]');
    clickedButton.classList.remove('bg-gray-200','text-gray-700');
    clickedButton.classList.add('bg-blue-500','text-white');
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
      <td class="border px-4 py-2"><a href="" class='text-sm text-blue-500 underline'>Related Jobs>></a></td>
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
    "Cloud_Platform",
    "Frontend",
    "Backend",
    "DevOps_tools",
    "Database",
    "Version_Control",
    "API",
    "Operating_System"
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

  // 渲染
  const container = document.getElementById('dynamicCategoryTags');
  container.innerHTML = '';

  categoryOrder.forEach(cat => {
    const techList = (grouped[cat] || [])
      .sort((a, b) => (b.mentions ?? b.Mentions) - (a.mentions ?? a.Mentions))
      .slice(0, 3);

    if (techList.length === 0) return; // 没有数据就不渲染

    // 标签
    let html = `<div class="flex items-center gap-x-3 mb-0">
      <label class="text-sm text-gray-400 text-nowrap w-40 text-start flex-shrink-0">${cat} :</label>
      `;

    techList.forEach((item, idx) => {
      const rawName = item.technology ?? item.Technology;
      const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      const percentage = ((item.percentage ?? item.Percentage) * 100).toFixed(2) + '%';
      // 第一个高亮，其余灰色
      html += `<button class="${idx === 0 ? 'bg-blue-500 text-white hover:bg-blue-700' : 'filter-time bg-gray-200 text-gray-700'} px-2 py-1 rounded-md hover:bg-gray-300 text-sm">${name} (${percentage})</button>`;
    });

    html += '</div>';

    container.innerHTML += html;
  });
}

function updateJobCount() {
  fetch('https://stacktrends-api-cshjb2ephxbjdffa.newzealandnorth-01.azurewebsites.net/api/job/count')
    .then(res => res.json())
    .then(data => {
      document.getElementById("job-count").textContent = data.count+" job posts";
      document.getElementById("job-count-2").textContent = data.count+" job posts";

    })
    .catch(err => console.error("Job count fetch failed:", err));
}

async function drawExperiencePie() {
  // 1. 请求后端接口
  const res  = await fetch('https://stacktrends-api-cshjb2ephxbjdffa.newzealandnorth-01.azurewebsites.net/api/count/by-level');
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

        color: ctx => ctx.dataIndex === selectedIndex ? '#3b82f6' : '#666',
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
  return fetch('https://stacktrends-api-cshjb2ephxbjdffa.newzealandnorth-01.azurewebsites.net/api/job/count/by-level')

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

    container.addEventListener('click', async function(e) {

        const btn = e.target.closest('button.level-filter-btn');
        if (!btn) return;            // 不是我们关心的按钮就忽略

      container.querySelectorAll('.level-filter-btn').forEach(b => {
        b.classList.remove('bg-blue-500','text-white');
        b.classList.add('bg-gray-200','text-gray-700');
      });

      // —— 再给当前按钮加上“选中”高亮 —— 
      btn.classList.remove('bg-gray-200','text-gray-700');
      btn.classList.add('bg-blue-500','text-white');

      const selectedLevel = btn.dataset.filter;  // 拿 data-filter

      const label = selectedLevel.charAt(0).toUpperCase() + selectedLevel.slice(1);
      const span = document.getElementById('jobLevel');
      if (span) span.textContent = label;

      selectedIndex = level_labels.findIndex(lab => lab.toLowerCase() === selectedLevel); // 这行
      if (experienceChart) {
        experienceChart.update();
      }

      try {
        const res = await fetch(`https://stacktrends-api-cshjb2ephxbjdffa.newzealandnorth-01.azurewebsites.net/api/count/tech_stacks?level=${selectedLevel}`);
        if (!res.ok) throw new Error(res.status);
        const data = await res.json();
        renderCategoryTags( data.filter(item =>
          (item.level ?? item.Level).toLowerCase() === selectedLevel
        ));
      } catch (err) {
        console.error('Failed to fetch tech stacks:', err);
      }

    });


  const allBtn = container.querySelector('button.level-filter-btn[data-filter="all"]');
  if (allBtn) {
    // 高亮样式
    allBtn.classList.remove('bg-gray-200','text-gray-700');
    allBtn.classList.add('bg-blue-500','text-white');
    // 如果你想让它立刻拉取并渲染 all 的数据，可以模拟一次点击：
    allBtn.click();
  }

}
