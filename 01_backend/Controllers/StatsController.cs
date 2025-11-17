using Npgsql;
using Microsoft.AspNetCore.Mvc;
using StackTrends.Models;


// ============================================================================================================
// This controller is responsible for providing general statistical data, such as the landing page summary.
// ============================================================================================================

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

            // try to read the next row, returns true if there is a row to read
            if (await reader.ReadAsync())
            {   
                // create a new landing summary object and populate it with data from the database
                var summary = new LandingSummary
                {
                    JobsCount = Convert.ToInt32(reader["jobs_count"]),
                    CompanyCount = Convert.ToInt32(reader["company_count"]),
                    KeywordCount = Convert.ToInt32(reader["keyword_count"]),
                    UpdatedAt = Convert.ToDateTime(reader["updated_at"])
                };

                // close the database connection first, then return the summary object as the response
                // if we return before closing, all the code after the return statement won't be executed
                await _conn.CloseAsync();
                return Ok(summary);
            }

            await _conn.CloseAsync();
            return NotFound("No landing summary found.");
        }

    }

}