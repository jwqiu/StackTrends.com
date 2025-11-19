// when user clicks admin button, check login status
// if logged in, redirect to admin page, otherwise show login modal
async function checkAndEnterAdminPage() {
  const token = sessionStorage.getItem("jwt");

  const res = await fetch(`${window.API_BASE}/api/account/check`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (res.status === 401) {
    document.getElementById("loginModal").classList.remove("hidden");
  } else {
    window.location.href = "ManageTechStacks.html";
  }
}

function closeLoginModal() {
  document.getElementById("loginModal").classList.add("hidden");
  document.getElementById("loginError").classList.add("hidden");
}

function showLoginError() {
  document.getElementById("loginError").classList.remove("hidden");
}

function submitLoginForm() {
  const form = document.getElementById("loginForm");
  const formData = new FormData(form);

  fetch(`${window.API_BASE}/api/account/login`, {
    method: "POST",
    body: formData
  })
    .then(res => res.ok ? res.json() : Promise.reject("Unauthorized"))
    .then(data => {
      // 存储 JWT
      sessionStorage.setItem('jwt', data.token);
      sessionStorage.setItem('isAdmin', 'true');
      sessionStorage.setItem('Username', formData.get('username'));
      closeLoginModal();
        window.location.href = "ManageTechStacks.html";
    })
    .catch(err => {
      console.error("Login failed:", err);
      showLoginError();
    });
}

// if user access the admin page directly, this function can be used to enforce login
function enforceLogin(redirectUrl = "index.html") {
  
  // if no JWT found, will get null
  const token = sessionStorage.getItem("jwt");

  fetch(`${window.API_BASE}/api/account/check`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
  .then(res => {
    if (res.status === 401) {
      // 未登录，重定向或弹出登录
        alert("Access denied. Please log in first.");
        window.location.href = redirectUrl;
    }
  })
  .catch(err => {
    console.error("Login check failed:", err);
    window.location.href = redirectUrl;

  });
}
