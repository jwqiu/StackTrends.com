

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


var builder = WebApplication.CreateBuilder(args);


// Register NpgsqlConnection in the DI container
builder.Services.AddScoped<NpgsqlConnection>(sp =>
    new NpgsqlConnection(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddControllers();

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
         .AllowAnyOrigin()
         .AllowAnyHeader()
         .AllowAnyMethod();
    });
});

// builder.Services.AddReverseProxy()
//        .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

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

var key = Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]);
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


builder.Services.AddAuthorization();

var app = builder.Build();

app.UseCors("AllowFE");
app.UseAuthentication();
app.UseAuthorization();

// app.UseDefaultFiles();    // 会默认返回 wwwroot/index.html
// app.UseStaticFiles();  // 会返回 wwwroot 下的静态文件

// var spaProvider = new PhysicalFileProvider(
//     Path.Combine(app.Environment.ContentRootPath, "../02_frontend")
// );
// app.UseDefaultFiles(new DefaultFilesOptions {
//     FileProvider = spaProvider,
//     RequestPath = ""
// });
// app.UseStaticFiles(new StaticFileOptions {
//     FileProvider = spaProvider,
//     RequestPath = ""
// });

// app.MapReverseProxy();
app.MapControllers();
app.Run();

