
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

[ApiController]
[Route("api/[controller]")]
public class AccountController : ControllerBase
{

    private readonly IConfiguration _config;
    public AccountController(IConfiguration config) => _config = config;

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromForm] string username, [FromForm] string password)
    {
        var adminUsername = _config["AdminAccount:Username"];
        var adminPassword = _config["AdminAccount:Password"];

        if (username == adminUsername && password == adminPassword)
        {
            // var claims = new List<Claim> {
            //     new Claim(ClaimTypes.Name, username)
            // };

            // var identity = new ClaimsIdentity(claims, "MyCookieAuth");
            // var principal = new ClaimsPrincipal(identity);

            // await HttpContext.SignInAsync("MyCookieAuth", principal);
            // return Ok(new { success = true });

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

    // [HttpPost("logout")]
    // public async Task<IActionResult> Logout()
    // {
    //     await HttpContext.SignOutAsync("MyCookieAuth");
    //     return Ok(new { success = true });
    // }
    [HttpPost("logout")]
    [Authorize]
    public IActionResult Logout()
    {
        // 对于 JWT，不需要在服务器做任何处理，只需提示前端删除 token
        return Ok(new { success = true, message = "Logged out successfully." });
    }

    [HttpGet("check")]
    [Authorize]
    public IActionResult CheckLogin()
    {
        return Ok(new { success = true });
    }
}
