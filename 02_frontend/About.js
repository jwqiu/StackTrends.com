document.addEventListener("DOMContentLoaded", () => {
  const articleButtons = document.querySelectorAll(".article-list [data-id]");
  const articles = document.querySelectorAll(".article-content [data-id]");

  articleButtons.forEach(button => {
    button.addEventListener("click", () => {
        const id = button.getAttribute("data-id");

        // 隐藏所有内容区
        articles.forEach(article => {
            article.style.display = "none";
        });

        // 显示目标内容区
        const target = document.querySelector(`.article-content [data-id="${id}"]`);
        if (target) target.style.display = "flex";

            // 取消所有高亮
        articleButtons.forEach(btn => btn.classList.remove("bg-blue-100"));

        // 给当前点击项加高亮
        button.classList.add("bg-blue-100");
        
    });
  });
});
