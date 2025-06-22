// import { mockData } from './mockData.js';

let topChart;

function initChart(labels, data) {
  const ctx = document.getElementById('myChart').getContext('2d');
  topChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        borderWidth: 1,
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
            display: false,
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
            display: true,      // ✅ 显示标签
            drawTicks: false,   // ❌ 不画刻度小线
            font: { size: 12 },
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
          align: 'top',
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
          barThickness: 28 // 控制柱子宽度
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

});

document.addEventListener('click', function (event) {
  if (event.target.classList.contains('filter-btn')) {
    const filterValue = event.target.getAttribute('data-filter').toLowerCase();
    filterTable(filterValue, event.target);
  }
});


function filterTable(filterValue,clickedButton) {  
  if (filterValue === 'all') {
    renderTechTableRows(allData,20);
    showMoreBtn.style.display = allData.length > 20 ? '' : 'none';
  }else {
    renderTechTableRows(allData); // 先渲染全部数据
    const rows = document.querySelectorAll('#techTable tr');
    showMoreBtn.style.display = 'none'; // 隐藏“显示更多”按钮
    rows.forEach(row => {
      const category = row.cells[1].textContent.toLowerCase();
      if (category === filterValue) {
        row.style.display = ''; // Show row
      } else {    
        row.style.display = 'none'; // Hide row
      }
    });
  }

  // rows.forEach(row => {
  //   const category = row.cells[1].textContent.toLowerCase();
  //   if (filterValue === 'all' || category === filterValue) {
  //     row.style.display = ''; // Show row
  //   } else {
  //     row.style.display = 'none'; // Hide row
  //   }
  // });

  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.remove('bg-blue-500','text-white');
    b.classList.add('bg-gray-200','text-gray-700');
  });

  // —— 再去掉当前按钮的灰底灰字，加上高亮 ——  
  clickedButton.classList.remove('bg-gray-200','text-gray-700');
  clickedButton.classList.add('bg-blue-500','text-white');
}

let allData = []; // 全部数据

async function loadTechRank() {
  try {
    const response = await fetch('https://localhost:5001/count/tech_stacks');
    const data = await response.json();
    allData = [...data].sort((a, b) => (b.percentage ?? b.Percentage) - (a.percentage ?? a.Percentage));
    renderCategoryTags(allData);
    renderTechTableRows(allData, 20); // 初始渲染20条
    
    const showMoreBtn = document.getElementById('showMoreBtn');
    showMoreBtn.style.display = data.length > 20 ? '' : 'none';

     if (!showMoreBtn.hasListener) {
      showMoreBtn.addEventListener('click', () => {
        renderTechTableRows(allData); // 全部渲染
        showMoreBtn.style.display = 'none'; // 隐藏按钮
      });
      showMoreBtn.hasListener = true; // 避免重复绑定
    }

    // const tbody = document.getElementById('techTable');
    // tbody.innerHTML = ''; // Clear previous rows

    const top10= allData.slice(0, 10); // Get top 10 items
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
      <td class="border px-4 py-2">${
        (item.technology ?? item.Technology)
          .charAt(0).toUpperCase() + (item.technology ?? item.Technology).slice(1)
      }</td>
      <td class="border px-4 py-2">${item.category ?? item.Category}</td>
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
      .slice(0, 5);

    if (techList.length === 0) return; // 没有数据就不渲染

    // 标签
    let html = `<div class="flex items-center gap-x-2 mb-0">
      <label class="text-sm text-gray-400 text-nowrap w-40 text-end flex-shrink-0">${cat} :</label>
      `;

    techList.forEach((item, idx) => {
      const name = item.technology ?? item.Technology;
      const mentions = item.mentions ?? item.Mentions;
      // 第一个高亮，其余灰色
      html += `<button class="${idx === 0 ? 'bg-blue-500 text-white hover:bg-blue-700' : 'filter-time bg-gray-200 text-gray-700'} px-2 py-1 rounded-md hover:bg-gray-300 text-sm">${name} (${mentions})</button>`;
    });

    html += '</div>';

    container.innerHTML += html;
  });
}

function updateJobCount() {
  fetch('https://localhost:5001/api/job/count')
    .then(res => res.json())
    .then(data => {
      document.getElementById("job-count").textContent = data.count;
    })
    .catch(err => console.error("Job count fetch failed:", err));
}

async function drawExperiencePie() {
  // 1. 请求后端接口
  const res  = await fetch('https://localhost:5001/count/experience_level');
  const data = await res.json(); 

  // 2. 准备标签和数据
  const labels   = data.map(d => d.level);
  const percents = data.map(d => d.percentage);

  // 3. 绘制饼图
  const ctx = document.getElementById('experiencePie').getContext('2d');
  new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
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
      maintainAspectRatio: false,

      layout: {
        padding: { left: 0, right: 0, top: 0, bottom: 0 }
      },

      plugins: {
        legend: {
          position: 'left',
          fullSize: false,
          align: 'center',
          padding: 0,
          labels: {
            font: {
              size: 18     // 图例文字大小（比如18px，可随意调大）
            },
            boxWidth: 24,   // 色块大小，默认大约为40，数值越大色块越大
            padding: 16     // 文字与色块之间的间距，也可以调整
          }
        },
        datalabels: {
          formatter: (value, ctx) => value.toFixed(2) + '%', // 变成百分比
          color: '#444',
          font: {
            size: 16
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.parsed.toFixed(2)}%`
          }
        }
      }
    }
  });
}

