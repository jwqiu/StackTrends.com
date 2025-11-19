// API endpoint selection based on environments
// LOCAL_API is used when running on localhost, development mode
// PROD_API is used when running in production mode

const LOCAL_API = "https://localhost:5001";

const PROD_API = "https://stacktrends-api-cshjb2ephxbjdffa.newzealandnorth-01.azurewebsites.net";

// if hostname is localhost or 127.0.0.1, use LOCAL_API, otherwise use PROD_API
// the result is stored in window.API_BASE for global access
const host = window.location.hostname;
window.API_BASE =
  host === "localhost" || host === "127.0.0.1"
    ? LOCAL_API
    : PROD_API;

