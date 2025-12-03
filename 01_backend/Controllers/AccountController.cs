
using Npgsql;
using Microsoft.AspNetCore.Mvc;
using StackTrends.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.Cookies;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;


// ============================================================================================================
// there are 3 endpoints for user authentication in this controller: login, logout, and check login status
// only the admin role can log in to the backend to manage tech keywords and categories
// ============================================================================================================
namespace StackTrends.Controllers
{
    
    [ApiController]
    [Route("api/[controller]")]
    // a controller is an object that groups related backend functions together to handle specific types of requests
    // whenever this controller receives a request, an instance of this controller is created, and the functions inside it can then be executed to handle the request
    public class AccountController : ControllerBase
    {
        // the main function of this controller is designed to verify the username and password entered by the user during login
        // to do this, we need to access the configuration settings where the admin username and password are stored and compare them with the input provided by the user
        // the _config variable is used to access these configuration values defined in appsettings.json
        // IConfiguration is not a class but an interface, in C#, interfaces usually start with "I" by convention
        private readonly IConfiguration _config;
        // this is the constructor of the account controller, it is called when an instance of this controller is created
        // the config parameter is automatically provided by the framework through dependency injection, it refers to the IConfiguration instance that has been registered in Program.cs
        public AccountController(IConfiguration config)
        {
            _config = config;
        }
        // the code above defines a private readonly variable named _config of type IConfiguration to hold the configuration settings
        // then assigns the IConfiguration instance registered in Program.cs to the _config variable through dependency injection in the constructor
        // this way, we can access the configuration settings anywhere within this controller using the _config variable

        // this login function handles user login requests, it verifies the provided username and password against the values in previously defined variable _config
        [HttpPost("login")]
        // task here represents an asynchronous operation. IActionResult is an interface that represents the result of an action method, Login is the name of the method, it could be any valid name
        public async Task<IActionResult> Login([FromForm] string username, [FromForm] string password)
        {
            // get the admin username and password from the configuration settings using the _config variable
            var adminUsername = _config["AdminAccount:Username"];
            var adminPassword = _config["AdminAccount:Password"];

            if (username == adminUsername && password == adminPassword)
            {
                // this code generates a secure JWT token for login, contains the user's name, uses a secret key from configuration for signing, and sets an expiration time of 1 hour
                var claims = new[] { new Claim(ClaimTypes.Name, username) };
                var key = Encoding.UTF8.GetBytes(_config["Jwt:Key"]);
                var creds = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256);
                var token = new JwtSecurityToken(
                    claims: claims,
                    expires: DateTime.UtcNow.AddHours(1),
                    signingCredentials: creds
                );
                return Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token) });
            }

            return Unauthorized(new { success = false, message = "Invalid credentials" });
        }

        [HttpPost("logout")]
        [Authorize]
        public IActionResult Logout()
        {
            // after logout, the frontend will simply delete the JWT token, so no need to do anything on the backend
            return Ok(new { success = true, message = "Logged out successfully." });
        }

        [HttpGet("check")]
        [Authorize]
        public IActionResult CheckLogin()
        {
            return Ok(new { success = true });
        }
    }
}