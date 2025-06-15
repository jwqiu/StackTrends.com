

using System;
using System.IO;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Builder;
using StackTrends.Models;


var builder = WebApplication.CreateBuilder(args);

// Register NpgsqlConnection in the DI container
builder.Services.AddScoped<NpgsqlConnection>(sp =>
    new NpgsqlConnection(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddControllers();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});
var app = builder.Build();

app.UseCors("AllowAll"); // 指定策略名
app.MapControllers();
app.Run();

