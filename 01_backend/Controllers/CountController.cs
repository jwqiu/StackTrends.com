using Npgsql;
using Microsoft.AspNetCore.Mvc;
using StackTrends.Models;

namespace StackTrends.Controllers
{
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
        public async Task<IEnumerable<TechStackCount>> GetCounts()
        {
            var counts = new List<TechStackCount>();

            await _conn.OpenAsync();
            // var cmd = new NpgsqlCommand();
            // var reader = await cmd.ExecuteReaderAsync();

            await using var cmd = new NpgsqlCommand("SELECT * FROM tech_stacks_frequency_count", _conn);
            await using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                counts.Add(new TechStackCount
                {
                    Technology = reader["Technology"].ToString(),
                    Category = reader["Category"].ToString(),
                    Mentions = Convert.ToInt32(reader["Mentions"]),
                    Percentage = Convert.ToDouble(reader["Percentage"])
                });
            }

            await _conn.CloseAsync();
            Console.WriteLine($"[Info] Returned {counts.Count} tech stack counts at {DateTime.Now}");

            return counts;
        }
    }
}