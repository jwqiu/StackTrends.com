import { mockData } from './mockData.js';

const ctx = document.getElementById('myChart').getContext('2d');
const myChart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: [
      'Azure',
      'AWS',
      'React',
      'C#',
      'JavaScript',
      '.NET',
      'TypeScript',
      'Python',
      'Git',
      'CSS'
    ],
    datasets: [{
      data: [148, 129, 125, 123, 123, 122, 89, 84, 76, 74],
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
        beginAtZero: false,  // 关闭自动从0开始
        min: 50,             // 强制从10开始
        max: 170,
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
        padding: 8
      },
      datalabels: {
        anchor: 'end',
        align: 'top',
        font: {
          size: 12
        },
        color: '#374151' // text-gray-800
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


// window.removeTag = function(button) {
//   button.parentElement.remove();
// };

// Event listener for filter buttons
document.addEventListener('click', function (event) {
  if (event.target.classList.contains('filter-btn')) {
    const filterValue = event.target.getAttribute('data-filter').toLowerCase();
    filterTable(filterValue, event.target);
  }
});



// Function to add event listeners to filter buttons
// function addFilterEventListeners() {
//   document.querySelectorAll('.filter-btn').forEach(button => {
//     button.addEventListener('click', function () {
//       const filterValue = this.getAttribute('data-filter').toLowerCase();
//       const clickedButton = this;
//       filterTable(filterValue,clickedButton);
//     });
//   });
// }

// Function to filter the table
function filterTable(filterValue,clickedButton) {
  const rows = document.querySelectorAll('#techTable tr');
  

  rows.forEach(row => {
    const category = row.cells[1].textContent.toLowerCase();
    if (filterValue === 'all' || category === filterValue) {
      row.style.display = ''; // Show row
    } else {
      row.style.display = 'none'; // Hide row
    }
  });

  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.remove('bg-blue-500','text-white');
    b.classList.add('bg-gray-200','text-gray-700');
  });

  // —— 再去掉当前按钮的灰底灰字，加上高亮 ——  
  clickedButton.classList.remove('bg-gray-200','text-gray-700');
  clickedButton.classList.add('bg-blue-500','text-white');
}

function populateTable(data) {
  const tableBody = document.getElementById('techTable');
  tableBody.innerHTML = ''; // Clear existing rows

  data.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'bg-white hover:bg-gray-100';

    tr.innerHTML = `
      <td class="border px-4 py-2">${row.technology}</td>
      <td class="border px-4 py-2">${row.category}</td>
      <td class="border px-4 py-2">${row.mentions}</td>
      <td class="border px-4 py-2">${row.percentage}</td>
      <td class="border px-4 py-2"><a href="" class='text-sm text-blue-500 underline'>Related Jobs>></a></td>

    `;

    tableBody.appendChild(tr);
  });
}

async function loadTechTable() {
  try {
    const response = await fetch('https://localhost:5001/frequency_count');
    const data = await response.json();

    const tbody = document.getElementById('techTable');
    tbody.innerHTML = ''; // Clear previous rows

    data.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="border px-4 py-2">${item.technology ?? item.Technology}</td>
        <td class="border px-4 py-2">${item.category ?? item.Category}</td>
        <td class="border px-4 py-2">${item.mentions ?? item.Mentions}</td>
        <td class="border px-4 py-2">${item.percentage ?? item.Percentage}</td>
        <td class="border px-4 py-2"><a href="" class='text-sm text-blue-500 underline'>Related Jobs>></a></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load tech stack data:', err);
  }
}

// // Call the function when the page loads
// window.addEventListener('DOMContentLoaded', loadTechTable);

document.addEventListener('DOMContentLoaded', () => {
  populateTable(mockData);
  loadTechTable(); // Load the tech table data

});