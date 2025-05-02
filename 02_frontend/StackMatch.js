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
    // Step 1: Get the selected tech stacks
    const selectedStacks = Array.from(
        document.querySelectorAll(".your-tech-stacks .flex.items-center")
    ).map((stack) => stack.childNodes[0].nodeValue.trim()); // Get only the text (excluding the button)

    // Step 2: Find all "Required Tech Stacks" elements
    const requiredStacksElements = document.querySelectorAll(
        ".required-tech-stacks"
    );

    requiredStacksElements.forEach((element) => {
        // Extract only the tech stacks (ignore the "Required Tech Stacks:" label)
        const stacksText = element.textContent.replace("Required Tech Stacks:", "").trim();
        const stacks = stacksText.split(",").map((stack) => stack.trim());

        // Step 3: Highlight matching tech stacks
        stacks.forEach((stack) => {
        if (selectedStacks.includes(stack)) {
            // Find the matching stack in the element and wrap it in a span
            const regex = new RegExp(`\\b${stack}\\b`, "g");
            element.innerHTML = element.innerHTML.replace(
            regex,
            `<span style="color: red;">${stack}</span>`
            );
        }
        });
    });
});