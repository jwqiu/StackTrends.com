using Npgsql;
using Microsoft.AspNetCore.Mvc;
using StackTrends.Models;

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

        [HttpGet("tech-stacks")]
        public async Task<IEnumerable<TechStackCount>> GetCounts([FromQuery] string level = "all")
        {
            var counts = new List<TechStackCount>();

            await _conn.OpenAsync();
            // var cmd = new NpgsqlCommand();
            // var reader = await cmd.ExecuteReaderAsync();

            // 基础 SQL
            var sql = @"
                SELECT job_level, category, technology, mentions, percentage
                FROM tech_stacks_frequency_count
            ";

            // 如果 level 不等于 all，就加过滤
            if (!string.IsNullOrWhiteSpace(level) && level.ToLower() != "all")
            {
                sql += " WHERE LOWER(job_level) = @level";
            }

            await using var cmd = new NpgsqlCommand(sql, _conn);

            if (!string.IsNullOrWhiteSpace(level) && level.ToLower() != "all")
            {
                // 注意把 level 转小写，和 WHERE 里 LOWER() 保持一致
                cmd.Parameters.AddWithValue("level", level.ToLower());
            }

            await using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                counts.Add(new TechStackCount
                {
                    Level = reader["job_level"].ToString()!,
                    Category = reader["category"].ToString(),
                    Technology = reader["technology"].ToString(),
                    Mentions = Convert.ToInt32(reader["mentions"]),
                    Percentage = Convert.ToDouble(reader["percentage"])
                });
            }

            await _conn.CloseAsync();
            Console.WriteLine($"[Info] Returned {counts.Count} tech stack counts at {DateTime.Now}");

            return counts;
        }


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
        
        // [HttpGet("tech-stacks-by-experience")]
        // public async Task<IEnumerable<TechStackCount>> GetTechStacksByExperience()
        // {
        //     var list = new List<TechStackCount>();

        //     const string sql = @"
        //         SELECT
        //             job_level   AS level,
        //             category,
        //             technology,
        //             mentions,
        //             percentage
        //         FROM tech_stacks_frequency_count
        //         ORDER BY
        //         CASE job_level
        //             WHEN 'Senior' THEN 1
        //             WHEN 'Intermediate' THEN 2
        //             WHEN 'Junior' THEN 3
        //             ELSE 4
        //         END,
        //         mentions DESC
        //     ";

        //     await _conn.OpenAsync();
        //     await using (var cmd = new NpgsqlCommand(sql, _conn))
        //     await using (var reader = await cmd.ExecuteReaderAsync())
        //     {
        //         while (await reader.ReadAsync())
        //         {
        //             list.Add(new TechStackCount
        //             {
        //                 Level      = reader.GetString(reader.GetOrdinal("level")),
        //                 Category   = reader.GetString(reader.GetOrdinal("category")),
        //                 Technology = reader.GetString(reader.GetOrdinal("technology")),
        //                 Mentions   = reader.GetInt32(reader.GetOrdinal("mentions")),
        //                 Percentage = reader.GetDouble(reader.GetOrdinal("percentage"))
        //             });
        //         }
        //     }
        //     await _conn.CloseAsync();

        //     return list;
        // }


    };
}