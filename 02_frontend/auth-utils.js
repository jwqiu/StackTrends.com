async function checkAndEnterAdminPage() {
  const token = sessionStorage.getItem("jwt");

  const res = await fetch(`${window.API_BASE}/api/account/check`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (res.status === 401) {
    // 未登录，弹出登录窗口
    document.getElementById("loginModal").classList.remove("hidden");
  } else {
    // 已登录，跳转到 Admin 页面
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

  // fetch(`${window.API_BASE}/api/account/login`, {
  //   method: "POST",
  //   credentials: "include",    // <— 加这一行
  //   body: formData
  // })
  //   .then(res => res.ok ? res.json() : Promise.reject("Unauthorized"))
  //   .then(data => {
  //     if (data.success) {
  //       closeLoginModal();
  //       sessionStorage.setItem('isAdmin', 'true');
  //       sessionStorage.setItem('Username', formData.get('username'));
  //       location.reload();
  //     } else {
  //       showLoginError();
  //     }
  //   })
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

// auth-utils.js
function enforceLogin(redirectUrl = "index.html") {
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
