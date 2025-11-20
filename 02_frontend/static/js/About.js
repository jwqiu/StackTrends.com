document.addEventListener("DOMContentLoaded", () => {
  setupArticleClickEvents();
  setupToggleBtnClickEvent();
  fetchLoginModal();
  setupAdminLinkClickEvent();

});

function setupArticleClickEvents(){

  // find all [data-id] elements inside .article-list and .article-content containers
  const articleButtons = document.querySelectorAll(".article-list [data-id]");
  const articles = document.querySelectorAll(".article-content [data-id]");

  articleButtons.forEach(button => {
    button.addEventListener("click", () => {
        // get the data-id of the clicked button
        const id = button.getAttribute("data-id");

        // hide all articles
        articles.forEach(article => {
            article.style.display = "none";
        });

        // select the article matching the clicked button's data-id and show it
        const target = document.querySelector(`.article-content [data-id="${id}"]`);
        if (target) target.style.display = "flex";

        // remove all highlights
        articleButtons.forEach(btn => btn.classList.remove("border-2", "border-blue-500"));

        // add highlight to the current clicked button
        button.classList.add("border-2", "border-blue-500");

    });

  });
  articleButtons[0].click(); // default click the first button when page first loads

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
