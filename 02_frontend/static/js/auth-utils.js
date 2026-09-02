function updateAdminNavLabel() {
  const adminNav = document.getElementById('adminLink') || document.getElementById('adminTab');
  if (!adminNav) return;

  const isLoggedIn = Boolean(sessionStorage.getItem('jwt'))
    && sessionStorage.getItem('isAdmin') === 'true';
  adminNav.textContent = isLoggedIn ? 'Admin' : 'Log in';
}

document.addEventListener('DOMContentLoaded', updateAdminNavLabel);

// Open the login modal when signed out; otherwise enter the admin page.
async function checkAndEnterAdminPage() {
  const token = sessionStorage.getItem("jwt");

  if (!token) {
    document.getElementById("loginModal")?.classList.remove("hidden");
    return;
  }

  const res = await fetch(`${window.API_BASE}/api/account/check`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (!res.ok) {
    sessionStorage.removeItem('jwt');
    sessionStorage.removeItem('isAdmin');
    sessionStorage.removeItem('Username');
    updateAdminNavLabel();
    document.getElementById("loginModal")?.classList.remove("hidden");
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

  // when login, we call the login API, if success, the backend will generate a JWT token and return it
  // then, we store the token in sessionStorage for later use
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
      updateAdminNavLabel();
      if (typeof window.handleAdminLoginSuccess === 'function') {
        window.handleAdminLoginSuccess();
      } else {
        window.location.href = 'ManageTechStacks.html';
      }
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
