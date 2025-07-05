using Npgsql;
using Microsoft.AspNetCore.Mvc;
using StackTrends.Models;

[ApiController]
[Route("api/[controller]")]
public class JobController : ControllerBase
{
    private readonly NpgsqlConnection _conn;

    public JobController(NpgsqlConnection conn)
    {
        _conn = conn;
    }

    // 🔍 1. 获取匹配职位列表（根据选中的 stacks / 日期 / 经验等级）
    // [HttpPost("match")]
    // public IActionResult GetMatchingJobs([FromBody] JobFilterRequest request)
    // {
    //     var result = _jobService.GetMatchingJobs(request);
    //     return Ok(result);
    // }

    // 🔝 2. 获取 Top 技术栈（左侧推荐列表用）
    // [HttpGet("top-techstacks")]
    // public IActionResult GetTopTechStacks()
    // {
    //     var result = _jobService.GetTopUsedStacks();
    //     return Ok(result);
    // }

    // 🧪 3. 获取所有职位（无过滤，用于调试）
    [HttpGet("all")]
    public async Task<IActionResult> GetAllJobs(
        int page = 1,
        int size = 20,
        string? job_level = null,
        [FromQuery] List<string>? keywords = null
    )

    {
        var jobs = new List<Job>();

        await _conn.OpenAsync();

        var whereConditions = new List<string>();
        if (!string.IsNullOrEmpty(job_level))
            whereConditions.Add("LOWER(job_level) = LOWER(@job_level)");

        if (keywords != null && keywords.Count > 0)
        {
            var keywordConds = keywords
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .Select((k, i) => $"LOWER(tech_tags) LIKE LOWER(@kw{i})")
                .ToList();
            whereConditions.Add("(" + string.Join(" AND ", keywordConds) + ")");
        }

        var whereClause = whereConditions.Count > 0
            ? "WHERE " + string.Join(" AND ", whereConditions)
            : "";

        // —— 1. 生成 match_count 的 CASE WHEN 表达式 ——  
        string matchExpr = "";
        if (keywords != null && keywords.Count > 0)
        {
            var cases = keywords
            .Where(k => !string.IsNullOrWhiteSpace(k))
                .Select((k, i) =>
                    $"CASE WHEN LOWER(tech_tags) LIKE LOWER(@kw{i}) THEN 1 ELSE 0 END")
                .ToList();
            matchExpr = string.Join(" + ", cases);
        }


        // 基础 SQL 查询
        var sql = @"
        SELECT 
            company_id, company_name, job_id, job_title, job_url, sub_id, sub_name,
            tech_tags as required_stacks,
            listed_date, location"
        + (string.IsNullOrEmpty(matchExpr)
            ? ""
            : $", ({matchExpr}) AS match_count")
        + @"
        FROM jobs
        " + whereClause + @"
        ORDER BY "
        + (string.IsNullOrEmpty(matchExpr)
            ? "listed_date DESC NULLS LAST"
            : "match_count DESC, listed_date DESC NULLS LAST")
        + @"
        OFFSET @offset LIMIT @limit";

        await using var cmd = new NpgsqlCommand(sql, _conn);

        cmd.Parameters.AddWithValue("offset", (page - 1) * size);
        cmd.Parameters.AddWithValue("limit", size);
        if (!string.IsNullOrEmpty(job_level) && job_level.ToLower() != "all")
            cmd.Parameters.AddWithValue("job_level", job_level);

        if (keywords != null && keywords.Count > 0)
        {
            for (int i = 0; i < keywords.Count; i++)
            {
                cmd.Parameters.AddWithValue($"kw{i}", $"%{keywords[i]}%");
            }
        }

        await using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            var job = new Job
            {
                JobId = Convert.ToInt32(reader["job_id"]), // 必须有值
                JobTitle = Convert.ToString(reader["job_title"]) ?? "",

                CompanyId = reader["company_id"] == DBNull.Value ? (int?)null : Convert.ToInt32(reader["company_id"]),
                CompanyName = reader["company_name"] == DBNull.Value ? null : reader["company_name"].ToString(),
                JobUrl = reader["job_url"] == DBNull.Value ? null : reader["job_url"].ToString(),
                SubId = reader["sub_id"] == DBNull.Value ? (int?)null : Convert.ToInt32(reader["sub_id"]),
                SubName = reader["sub_name"] == DBNull.Value ? null : reader["sub_name"].ToString(),
                RequiredStacks = (Convert.ToString(reader["required_stacks"]) ?? "")
                    .Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(s => s.Trim())
                    .ToList(),
                ListedDate = reader["listed_date"] == DBNull.Value ? (DateTime?)null : Convert.ToDateTime(reader["listed_date"]),
                JobLocation = reader["location"] == DBNull.Value ? null : reader["location"].ToString(),
            };

            jobs.Add(job);
        }

        await _conn.CloseAsync();

        // var sortedJobs = jobs
        // .OrderByDescending(j => j.ListedDate ?? DateTime.MinValue)
        // .ToList();

        bool hasMore = jobs.Count == size; // 如果当前页填满，说明还有下一页
        return Ok(new { jobs, hasMore });
    }

    [HttpGet("count")]
    public async Task<IActionResult> JobsCount(
        string? job_level = null,
        [FromQuery] List<string>? keywords = null)
    {
        await _conn.OpenAsync();

        var whereConditions = new List<string>();
        if (!string.IsNullOrEmpty(job_level) && job_level.ToLower() != "all")
            whereConditions.Add("LOWER(job_level) = LOWER(@job_level)");
        if (keywords != null && keywords.Count > 0)
        {
            var keywordConds = keywords
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .Select((k, i) => $"LOWER(tech_tags) LIKE LOWER(@kw{i})")
                .ToList();
            whereConditions.Add("(" + string.Join(" AND ", keywordConds) + ")");
        }

        var whereClause = whereConditions.Count > 0
            ? "WHERE " + string.Join(" AND ", whereConditions)
            : "";

        var sql = $"SELECT COUNT(*) FROM jobs {whereClause}";

        await using var cmd = new NpgsqlCommand(sql, _conn);
        if (!string.IsNullOrEmpty(job_level) && job_level.ToLower() != "all")
            cmd.Parameters.AddWithValue("job_level", job_level);
        if (keywords != null && keywords.Count > 0)
        {
            for (int i = 0; i < keywords.Count; i++)
            {
                cmd.Parameters.AddWithValue($"kw{i}", $"%{keywords[i]}%");
            }
        }

        var count = Convert.ToInt32(await cmd.ExecuteScalarAsync());

        await _conn.CloseAsync();
        return Ok(new { count });
    }

    [HttpGet("count/by-level")]
    public async Task<ActionResult<IEnumerable<JobCountByLevelDto>>> GetCountByLevel()
    {
        var list = new List<JobCountByLevelDto>();

        await _conn.OpenAsync();

        // UNION ALL：第一行是 All 的总数，后面再 GROUP BY
        const string sql = @"
        SELECT *
        FROM (
            SELECT 'All' AS job_level, COUNT(*) AS cnt FROM jobs
            UNION ALL
            SELECT job_level, COUNT(*) AS cnt FROM jobs GROUP BY job_level
        ) t
        ORDER BY
            CASE job_level
                WHEN 'All' THEN 0
                WHEN 'Senior' THEN 1
                WHEN 'Intermediate' THEN 2
                WHEN 'Junior' THEN 3
                ELSE 4
            END;
        ";

        await using var cmd = new NpgsqlCommand(sql, _conn);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            list.Add(new JobCountByLevelDto
            {
                Level = reader.GetString(reader.GetOrdinal("job_level")),
                Count = reader.GetInt32(reader.GetOrdinal("cnt"))
            });
        }

        await _conn.CloseAsync();
        return Ok(list);
    }
    [HttpGet("search/by-keyword")]
    public async Task<ActionResult<List<Job>>> SearchJobsByKeyword([FromQuery] string keyword)
    {
        if (string.IsNullOrWhiteSpace(keyword))
            return BadRequest("Keyword is required.");

        await _conn.OpenAsync();

        var jobs = new List<Job>();

        const string sql = @"
            SELECT 
                job_id, 
                job_title,
                company_id,
                company_name,
                job_url,
                job_des,
                sub_id,
                sub_name,
                listed_date,
                location,
                job_des_origin
            FROM jobs
            WHERE to_tsvector('english', job_des) @@ plainto_tsquery('english', @kw)
            ORDER BY listed_date DESC NULLS LAST
            ;";  // 可选，限制返回数量

        await using var cmd = new NpgsqlCommand(sql, _conn);
        cmd.Parameters.AddWithValue("kw", keyword);

        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            jobs.Add(new Job
            {
                JobId = Convert.ToInt32(reader["job_id"]),
                JobTitle = reader["job_title"].ToString() ?? "",
                CompanyId = reader["company_id"] as int?,
                CompanyName = reader["company_name"]?.ToString(),
                JobUrl = reader["job_url"]?.ToString(),
                JobDescription = reader["job_des_origin"]?.ToString(),
                SubId = reader["sub_id"] as int?,
                SubName = reader["sub_name"]?.ToString(),
                ListedDate = reader["listed_date"] == DBNull.Value ? (DateTime?)null : Convert.ToDateTime(reader["listed_date"]),
                JobLocation = reader["location"]?.ToString(),
                RequiredStacks = null // 如果你之后想支持 JSON 数组再处理
            });
        }

        await _conn.CloseAsync();
        return Ok(jobs);
    }

}
