

using System;
using System.IO;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Builder;

var builder = WebApplication.CreateBuilder(args);

// Register NpgsqlConnection in the DI container
builder.Services.AddScoped<NpgsqlConnection>(sp =>
    new NpgsqlConnection(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});
var app = builder.Build();

app.UseCors();
app.MapControllers();

app.Run();

[ApiController]
[Route("frequency_count")]
public class CountController : ControllerBase
{
    private readonly NpgsqlConnection _conn;

    public CountController(NpgsqlConnection conn)
    {
        _conn = conn;
    }

    [HttpGet]
    public async Task<IEnumerable<object>> GetCounts()
    {
        var counts = new List<object>();

        await _conn.OpenAsync();
        // var cmd = new NpgsqlCommand();
        // var reader = await cmd.ExecuteReaderAsync();

        await using var cmd = new NpgsqlCommand("SELECT * FROM tech_stacks_frequency_count_0415", _conn);
        await using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            counts.Add(new {
                Technology = reader["Technology"],
                Category = reader["Category"],
                Mentions = reader["Mentions"],
                Percentage = reader["Percentage"]
            });
        }

        await _conn.CloseAsync();
        Console.WriteLine($"[Info] Returned {counts.Count} tech stack counts at {DateTime.Now}");

        return counts;
    }
}