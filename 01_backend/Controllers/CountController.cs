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

        [HttpGet("match/keyword")]
        public async Task<IActionResult> GetKeywordMatchStats([FromQuery] string keyword)
        {
            if (string.IsNullOrWhiteSpace(keyword))
                return BadRequest("Keyword is required.");

            await _conn.OpenAsync();

            var result = new KeywordMatchResult
            {
                TotalMatches = 0,
                TotalJobs = 0,
                OverallPercentage = 0.0,
                LevelBreakdown = new List<LevelMatch>()
            };

            const string totalCountSql = @"SELECT COUNT(*) FROM jobs;";
            const string totalMatchSql = @"
                SELECT COUNT(*) 
                FROM jobs 
                WHERE to_tsvector('english', job_des) @@ plainto_tsquery('english', @kw)";
            const string levelBreakdownSql = @"
            SELECT job_level, COUNT(*) AS MatchCount
            FROM jobs
            WHERE to_tsvector('english', job_des) @@ plainto_tsquery('english', @kw)
            GROUP BY job_level
            ORDER BY
                CASE job_level
                    WHEN 'Senior' THEN 1
                    WHEN 'Intermediate' THEN 2
                    WHEN 'Junior' THEN 3
                    ELSE 4
                END;";
            const string levelTotalSql = @"
            SELECT job_level, COUNT(*) AS TotalCount
            FROM jobs
            GROUP BY job_level;";


            // 查询总 job 数量
            await using (var cmd = new NpgsqlCommand(totalCountSql, _conn))
            {
                result.TotalJobs = Convert.ToInt32(await cmd.ExecuteScalarAsync());
            }

            // 查询匹配的总数量
            await using (var cmd = new NpgsqlCommand(totalMatchSql, _conn))
            {
                cmd.Parameters.AddWithValue("kw", keyword);
                result.TotalMatches = Convert.ToInt32(await cmd.ExecuteScalarAsync());
            }

            result.OverallPercentage = result.TotalJobs > 0
                ? Math.Round(result.TotalMatches * 100.0 / result.TotalJobs, 2)
                : 0.0;

            // 查询各等级总数
            var levelTotalDict = new Dictionary<string, int>();
            await using (var cmd = new NpgsqlCommand(levelTotalSql, _conn))
            {
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var level = reader["job_level"].ToString();
                    var total = Convert.ToInt32(reader["TotalCount"]);
                    levelTotalDict[level] = total;
                }
            }

            // 查询各等级匹配数量
            await using (var cmd = new NpgsqlCommand(levelBreakdownSql, _conn))
            {
                cmd.Parameters.AddWithValue("kw", keyword);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var level = reader["job_level"].ToString();
                    var matchCount = Convert.ToInt32(reader["MatchCount"]);
                    var percentage = levelTotalDict.ContainsKey(level) && levelTotalDict[level] > 0
                        ? Math.Round(matchCount * 100.0 / levelTotalDict[level], 2)
                        : 0.0;

                    result.LevelBreakdown.Add(new LevelMatch
                    {
                        Level = level,
                        MatchCount = matchCount,
                        Percentage = percentage
                    });
                }
            }

            await _conn.CloseAsync();
            return Ok(result);
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

        [HttpGet("tech-trends")]
        public async Task<IEnumerable<TechTrend>> GetTrends()
        {
            var trends = new List<TechTrend>();

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
                trends.Add(new TechTrend
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