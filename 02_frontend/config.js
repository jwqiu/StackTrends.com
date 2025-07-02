// config.js

// 本地调试时后端跑在 localhost:5001
const LOCAL_API = "https://localhost:5001";

// 正式环境后端和静态文件同域（或走相对路径）
const PROD_API = "https://stacktrends-api-cshjb2ephxbjdffa.newzealandnorth-01.azurewebsites.net";

// 判断当前是在本地开发（常见 localhost、127.0.0.1），还是线上
const host = window.location.hostname;
window.API_BASE =
  host === "localhost" || host === "127.0.0.1"
    ? LOCAL_API
    : PROD_API;
