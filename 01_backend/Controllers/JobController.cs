using Npgsql;
using Microsoft.AspNetCore.Mvc;
using StackTrends.Models;

[ApiController]
[Route("api/jobs")]
public class JobController : ControllerBase
{
    private readonly NpgsqlConnection _conn;

    public JobController(NpgsqlConnection conn)
    {
        _conn = conn;
    }

    [HttpGet("list")]
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

    [HttpGet("stats/by-level")]
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

    [HttpGet("search/list")]
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

    [HttpGet("stats/by-month")]
    public async Task<ActionResult<IEnumerable<JobCountByMonthDto>>> GetCountByMonth()
    {
        var list = new List<JobCountByMonthDto>();
        await _conn.OpenAsync();

        const string sql = @"
            SELECT listing_year_month, jobs_count
            FROM jobs_count_by_month
            ORDER BY to_date(replace(listing_year_month,'/','-') || '-01','YYYY-MM-DD');
        ";

        await using var cmd = new NpgsqlCommand(sql, _conn);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            list.Add(new JobCountByMonthDto
            {
                YearMonth = reader.GetString(reader.GetOrdinal("listing_year_month")),
                Count     = reader.GetInt32(reader.GetOrdinal("jobs_count"))
            });
        }

        await _conn.CloseAsync();
        return Ok(list);
    }


    // Use IEnumerable when we just need to read data sequentially, use List when we need to modify it or access by index
    // use ActionResult<T> when the action should return a typed result on success, and HTTP error results when something goes wrong
    // use IActionResult when the action only returns HTTP responses and no specific types needs to be declared
    // the type after ActionResult<> indicates the data type returned on a successful response
    [HttpGet("stats/by-company")]
    public async Task<ActionResult<IEnumerable<JobCountByCompany>>> GetTop20CompaniesByJobCount()
    {
        // only get companies with more than 10 job postings, ordered by job count descending
        // TODO: Maybe remove the 10-job threshold here and move this filter into the job_counts_by_company creation logic.
        const string sql = @"
            SELECT company_id, company_name, jobs_count
            FROM public.job_counts_by_company
            WHERE jobs_count > 10
            ORDER BY jobs_count DESC;
        ";

        // if want Single object , use new CompaniesCount() ,if want a list of same object, use new List<CompaniesCount>();
        var result = new List<JobCountByCompany>();

        await _conn.OpenAsync();
        using var cmd = new NpgsqlCommand(sql, _conn);
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            // get the column indexes first to avoid issues if the column order changes in the future
            var idxCompanyId = reader.GetOrdinal("company_id");
            var idxCompanyName = reader.GetOrdinal("company_name");
            var idxJobsCount = reader.GetOrdinal("jobs_count");
            
            result.Add(new JobCountByCompany
            {
                Company_Id = (int)reader.GetInt64(idxCompanyId),
                Company_name = reader.IsDBNull(idxCompanyName) ? null : reader.GetString(idxCompanyName),
                Jobs_Count = (int)reader.GetInt64(idxJobsCount)
            });
        }
        await _conn.CloseAsync();

        return Ok(result);
    }

    [HttpGet("search/stats")]
    public async Task<IActionResult> GetKeywordMatchStats([FromQuery] string keyword)
    {
        if (string.IsNullOrWhiteSpace(keyword))
            return BadRequest("Keyword is required.");

        await _conn.OpenAsync();

        var result = new KeywordMatchStats
        {
            TotalMatches = 0,
            TotalJobs = 0,
            OverallPercentage = 0.0,
            LevelBreakdown = new List<LevelMatchStats>()
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

                result.LevelBreakdown.Add(new LevelMatchStats
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
}
