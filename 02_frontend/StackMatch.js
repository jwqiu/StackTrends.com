const API_BASE = window.API_BASE;
let currentJobLevel = "ALL";
let allTechStacks = [];
let selectedStacks = [];


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
    
});

function highlightStacksHtml(stacks, selected) {
  const clean = stacks
    .filter(s => s && s.trim())
    .map(s => s.trim());

  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const matched = clean.filter(s => selected.includes(s.toLowerCase()));
  const unmatched = clean.filter(s => !selected.includes(s.toLowerCase()));
  return [
    ...matched.map(s => `<span class="text-red-500">${capitalize(s)}</span>`),
    ...unmatched.map(s => `<span>${capitalize(s)}</span>`)
  ].join(' , ') || 'N/A';
}

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
  let url = `https://stacktrends-api-cshjb2ephxbjdffa.newzealandnorth-01.azurewebsites.net/api/job/all?page=${currentPage}&size=${jobsPerPage}`;
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
        <div class="p-8 bg-white border border-gray-200 rounded-lg shadow hover:border-blue-300 hover:border-2">
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
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 1 1-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 0 1 6.336-4.486l-3.276 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.867 19.125h.008v.008h-.008v-.008Z" />
                </svg>
                Tech Requirements:
            </p>
            <p class="required-tech-stacks text-sm mt-1">
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
    const response = await fetch('https://stacktrends-api-cshjb2ephxbjdffa.newzealandnorth-01.azurewebsites.net/api/TechStack/all');
    allTechStacks = await response.json();
    document.getElementById("techstack-input").addEventListener("input", showSuggestions);
    document.getElementById("add-btn").addEventListener("click", addSelectedStack);

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
        btn.onclick = function() {
            selectedStacks = selectedStacks.filter(n => n !== btn.dataset.name);
            renderSelectedStacks();
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

function applyFilters() {
    document.querySelector('.apply-filters-btn')?.addEventListener('click', async () => {
    currentPage = 1;
    allJobs = [];
    await loadJobs();
    await getFilterResultsCount();
  });
}

async function getFilterResultsCount() {
  let url = `https://stacktrends-api-cshjb2ephxbjdffa.newzealandnorth-01.azurewebsites.net/api/Job/count?job_level=${encodeURIComponent(currentJobLevel)}`;

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
