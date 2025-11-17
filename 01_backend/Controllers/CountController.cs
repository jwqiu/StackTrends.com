using Npgsql;
using Microsoft.AspNetCore.Mvc;
using StackTrends.Models;


// ============================================================================================================
// this controller is currently not in use, but kept for potential future use
// ============================================================================================================


namespace StackTrends.Controllers
{   
    
    [ApiController]
    [Route("api/[controller]")]
    public class CountController : ControllerBase

    {
        private readonly NpgsqlConnection _conn;

        public CountController(NpgsqlConnection conn)
        {
            _conn = conn;
        }

        // this endpoint is no longer used, but kept for potential future use
        [HttpGet("by-level")]
        public async Task<IEnumerable<ExperienceLevelCount>> GetExperienceLevelCounts()
        {
            var counts = new List<ExperienceLevelCount>();

            // 打开连接
            await _conn.OpenAsync();

            // 直接按 job_level 分组统计
            var sql = @"
            SELECT
                job_level      AS Level,
                COUNT(*)       AS Mentions,
                ROUND(
                COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (),
                2
                )              AS Percentage
            FROM jobs
            GROUP BY job_level
            ORDER BY
                CASE job_level
                WHEN 'Senior'       THEN 1
                WHEN 'Intermediate' THEN 2
                WHEN 'Junior'       THEN 3
                ELSE 4
                END;
            ";

            await using var cmd = new NpgsqlCommand(sql, _conn);
            await using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                counts.Add(new ExperienceLevelCount
                {
                    Level = reader["Level"].ToString()!,
                    Mentions = Convert.ToInt32(reader["Mentions"]),
                    Percentage = Convert.ToDouble(reader["Percentage"])
                });
            }

            await _conn.CloseAsync();
            return counts;
        }

        // This endpoint fetches the data that shows the top growing and declining tech skills over time. 
        // Because the current data doesn’t provide meaningful or interpretable insights, I decided not to display it on the website for now
        [HttpGet("tech-trends")]
        public async Task<IEnumerable<TechTrendPoint>> GetTrends()
        {
            var trends = new List<TechTrendPoint>();

            await _conn.OpenAsync();

            var sql = @"
                SELECT month, tech, mention_rate, trend_type
                FROM top_growing_and_declining_techs
                ORDER BY month ASC, tech ASC
            ";

            await using var cmd = new NpgsqlCommand(sql, _conn);
            await using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                trends.Add(new TechTrendPoint
                {
                    Month = reader["month"].ToString()!,
                    Technology = reader["tech"].ToString()!,
                    Percentage = Convert.ToDouble(reader["mention_rate"]),
                    TrendType = reader["trend_type"].ToString()!
                });
            }

            await _conn.CloseAsync();

            Console.WriteLine($"[Info] Returned {trends.Count} tech trends at {DateTime.Now}");

            return trends;
        }

    };
}