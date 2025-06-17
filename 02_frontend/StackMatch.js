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
});


function highlightMatchingStacks(){
  // Step 1: Get the selected tech stacks
  const selectedStacks = Array.from(
      document.querySelectorAll(".your-tech-stacks .flex.items-center")
  ).map((stack) => stack.childNodes[0].nodeValue.trim().toLowerCase()); // Get only the text (excluding the button)

  // Step 2: Find all "Required Tech Stacks" elements
  const requiredStacksElements = document.querySelectorAll(
      ".required-tech-stacks"
  );

  requiredStacksElements.forEach((element) => {
      // Extract only the tech stacks (ignore the "Required Tech Stacks:" label)
      const stacksText = element.textContent.replace("Required Tech Stacks:", "").trim();
      const stacks = stacksText.split(",").map((stack) => stack.trim().toLowerCase());

      const matchingStacks = stacks.filter((stack) => selectedStacks.includes(stack));
      const nonMatchingStacks = stacks.filter((stack) => !selectedStacks.includes(stack));

      element.innerHTML = `<strong>Required Tech Stacks: </strong><span class="text-red-600">${matchingStacks.join(", ")}</span>, ${nonMatchingStacks.join(", ")}`;
  });
}

let allJobs = []; // 存全部jobs
let jobsPerPage = 20;
let currentPage = 1;

async function loadJobs() {
  // 调用后端API获取所有职位
  const response = await fetch('https://localhost:5001/api/job/all');
  allJobs = await response.json();
  currentPage = 1;
  renderJobs(); // 渲染第一页

}

function renderJobs() {
  const jobList = document.getElementById('job-list');
  jobList.innerHTML = ""; // 清空旧内容

  const jobsToShow = allJobs.slice(0, currentPage * jobsPerPage);

  jobsToShow.forEach(job => {
    // 拼接 required stacks
    const stacks = job.requiredStacks
          ? job.requiredStacks.filter(s => s && s.trim() !== '').join(', ')
          : '';
    // 可自定义图片路径和其它字段
    const html = `
      <div class="p-4 bg-gray-50 rounded shadow">
        <div class="flex items-center gap-4">
          <div>
            <h3 class="font-semibold text-lg text-grey-700">${job.jobTitle}</h3>
            <p class="text-sm text-gray-600">
              Company: ${job.companyName ?? ''} 
            </p>
          </div>
          <img src="./static/images/seeklogo.png" alt="" class="w-10 h-10 rounded-full ms-auto">        
        </div>
        <p class="text-sm py-1 text-gray-600">
          ${job.jobUrl ? ` <a href="${job.jobUrl}" class="underline text-blue-500" target="_blank">Check Job detail>> </a>` : ''}
        </p>
        <p class="required-tech-stacks text-sm mt-1">
          <strong>Required Tech Stacks:</strong> ${stacks}
        </p>
        
      </div>
    `;
    jobList.insertAdjacentHTML('beforeend', html);
  });
  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.style.display = (currentPage * jobsPerPage < allJobs.length) ? 'block' : 'none';
  }

}

function loadMoreJobs() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        currentPage++;
        renderJobs();
      });
    }
}

let allTechStacks = [];
let selectedStacks = [];

async function loadTechStacks() {
  // 调用后端API获取所有技术栈
  try {
    const response = await fetch('https://localhost:5001/api/TechStack/all');
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

function addSelectedStack() {
    const input = document.getElementById("techstack-input");
    const name = input.value.trim();
    if (!name) return;

    // 避免重复
    if (!selectedStacks.includes(name)) {
        selectedStacks.push(name);
        renderSelectedStacks();
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
    highlightMatchingStacks();

}