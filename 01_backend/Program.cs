

using System;
using System.IO;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Builder;
using StackTrends.Models;
using Microsoft.Extensions.DependencyInjection;
// using Microsoft.Extensions.FileProviders;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

// create a web application builder, like laying the foundation where we prepare everything(services, settings, tools) before building the web app
var builder = WebApplication.CreateBuilder(args);

// register a PostgreSQL database connection so controllers don't need to create it manually
builder.Services.AddScoped<NpgsqlConnection>(sp => new NpgsqlConnection(builder.Configuration.GetConnectionString("DefaultConnection")));

// Register controllers so we can build backend functions for different features in separate controllers
// basically, controller is a collection of related backend functions that share the same API route
builder.Services.AddControllers();


// ============================================================
// 🔹 Used CORS to handle cross-origin requests
// ============================================================
// The frontend and backend run on different endpoints, and the browsers don't allow them communicate directly, so I used CORS here to handle cross-origin requests
// AddCors is mainly used during development or for small projects, because it's quick and easy to allow requests from the frontend to the backend directly（just a few lines of code）.
// but it's not very secure（it exposes the backend endpoint） or easy to maintain when there are multiple services.
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFE", policy =>
    {
        // policy
        //   .WithOrigins("http://127.0.0.1:5500", "https://www.stackradar.me", "https://localhost:5001")  // 改成你网页实际的 origin
        //   .AllowAnyHeader()
        //   .AllowAnyMethod()
        //   .AllowCredentials();   // 一定要加这一行，才能让浏览器带上 Cookie
       policy
        .WithOrigins(
            "https://www.stackradar.me",
            "http://127.0.0.1:5500",
            "http://localhost:5500"
          )
        .AllowAnyHeader()
        .AllowAnyMethod();
    });
});

// ======================================================================
// 🔹 Better way to handle cross-origin requests by using reverse proxy
// ======================================================================
// to address the cross-origin issue between frontend and backend, reverse proxy is a more common and popular solution,  because it's safer - it hides the backend, 
// faster - there is no pre-check for cross-origin requests, easier to maintain - you just change the config, and it also helps manage multiple backend services in one place
// a reverse proxy means the frontend doesn't talk to the backend directly, instead, it sends requests to another address - usually under the same domain as the frontend
// and that proxy server forwards the requests to the actual backend server, and sends the results back to the frontend
// because the proxy talks to the backend server, not through the broweser, so there is no cross-origin issue

// builder.Services.AddReverseProxy()
//        .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));


// ======================================================================
// 🔹 Different approach to handle user authentication
// ======================================================================
// Cookies/sessions and JWT(JSON Web Token) are the most common ways to handle user authentication/verify logged-in users in modern web development.
// the cookie/session method is a stateful approach, where the server maintains the session data for all logged-in users. which makes the system more complex and harder to scale.
// the JWT method is a stateless approach, where the backend issues a token for each logged-in user and verifies it on every request instead of maintaining session data on the server, which makes the system simpler and easier to scale

// builder.Services.AddAuthentication("MyCookieAuth")
//     .AddCookie("MyCookieAuth", options =>
//     {
//         options.LoginPath = "/api/account/login"; // 只是占位
//         options.Events.OnRedirectToLogin = context =>
//         {
//             // 返回401，不要重定向
//             context.Response.StatusCode = 401;
//             return Task.CompletedTask;
//         };
//     });

// JWT is now more commonly used than traditional cookie-based authentication in modern web applications, because it reduces system complexity and improve scalability.

// load the secret key from configuration(appsettings.json) and configure JWT authentication
var key = Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]);
// configure the authentication and token validation rules
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
    ValidateIssuerSigningKey = true,
    IssuerSigningKey = new SymmetricSecurityKey(key),
    ValidateIssuer = false,
    ValidateAudience = false,
    ClockSkew = TimeSpan.Zero
    };
});

// register the authorization services so i can mark which backend endpoints need authentication to access
builder.Services.AddAuthorization();

// build the web application instance using the previously configured builder
var app = builder.Build();

// use the CORS policy defined earlier to allow frontend requests
app.UseCors("AllowFE");
app.UseAuthentication();
app.UseAuthorization();

// app.MapReverseProxy();

// register all controller endpoints so incoming requests can be correctly routed to the right controller functions
app.MapControllers();
app.Run();

