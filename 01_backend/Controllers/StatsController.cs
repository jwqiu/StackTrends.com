using Npgsql;
using Microsoft.AspNetCore.Mvc;
using StackTrends.Models;

namespace StackTrends.Controllers
{
    [ApiController]
    [Route("api/stats")]
    public class StatsController : ControllerBase

    {
        private readonly NpgsqlConnection _conn;

        public StatsController(NpgsqlConnection conn)
        {
            _conn = conn;
        }
    
        [HttpGet("landing-summary")]
        public async Task<ActionResult<LandingSummary>> GetLandingSummary()
        {
            await _conn.OpenAsync();

            const string sql = @"
                SELECT jobs_count, company_count, keyword_count, updated_at
                FROM landing_summary
                ORDER BY updated_at DESC
                LIMIT 1;
            ";

            await using var cmd = new NpgsqlCommand(sql, _conn);
            await using var reader = await cmd.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                var summary = new LandingSummary
                {
                    JobsCount = Convert.ToInt32(reader["jobs_count"]),
                    CompanyCount = Convert.ToInt32(reader["company_count"]),
                    KeywordCount = Convert.ToInt32(reader["keyword_count"]),
                    UpdatedAt = Convert.ToDateTime(reader["updated_at"])
                };

                await _conn.CloseAsync();
                return Ok(summary);
            }

            await _conn.CloseAsync();
            return NotFound("No landing summary found.");
        }

    }

}