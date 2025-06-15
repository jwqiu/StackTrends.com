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
  //  highlightMatchingStacks();
   loadJobs();
});


// function highlightMatchingStacks(){
//   // Step 1: Get the selected tech stacks
//   const selectedStacks = Array.from(
//       document.querySelectorAll(".your-tech-stacks .flex.items-center")
//   ).map((stack) => stack.childNodes[0].nodeValue.trim()); // Get only the text (excluding the button)

//   // Step 2: Find all "Required Tech Stacks" elements
//   const requiredStacksElements = document.querySelectorAll(
//       ".required-tech-stacks"
//   );

//   requiredStacksElements.forEach((element) => {
//       // Extract only the tech stacks (ignore the "Required Tech Stacks:" label)
//       const stacksText = element.textContent.replace("Required Tech Stacks:", "").trim();
//       const stacks = stacksText.split(",").map((stack) => stack.trim());

//       const matchingStacks = stacks.filter((stack) => selectedStacks.includes(stack));
//       const nonMatchingStacks = stacks.filter((stack) => !selectedStacks.includes(stack));

//       element.innerHTML = `<strong>Required Tech Stacks: </strong><span class="text-red-600">${matchingStacks.join(", ")}</span>, ${nonMatchingStacks.join(", ")}`;
//   });
// }

async function loadJobs() {
  // 调用后端API获取所有职位
  const response = await fetch('https://localhost:5001/api/job/all');
  const jobs = await response.json();

  const jobList = document.getElementById('job-list');
  jobList.innerHTML = ""; // 清空旧内容

  jobs.forEach(job => {
    // 拼接 required stacks
    const stacks = job.requiredStacks
          ? job.requiredStacks.filter(s => s && s.trim() !== '').join(', ')
          : '';
    // 可自定义图片路径和其它字段
    const html = `
      <div class="p-4 bg-gray-50 rounded shadow">
        <div class="flex items-center gap-4">
          <div>
            <h3 class="font-semibold text-lg text-blue-700">${job.jobTitle}</h3>
            <p class="text-sm text-gray-600">
              Company: ${job.companyName ?? ''} ·${job.jobUrl ? ` <a href="${job.jobUrl}" class="underline text-blue-500" target="_blank">Job Link</a>` : ''}
            </p>
          </div>
          <img src="/image.png" alt="" class="w-12 h-12 rounded-full ms-auto">
        </div>
        <p class="required-tech-stacks text-sm mt-1">
          <strong>Required Tech Stacks:</strong> ${stacks}
        </p>
      </div>
    `;
    jobList.insertAdjacentHTML('beforeend', html);
  });
}


