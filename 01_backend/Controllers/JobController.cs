using Npgsql;
using Microsoft.AspNetCore.Mvc;
using StackTrends.Models;

// ============================================================================================================
// there are 7 endpoints in this controller related to job data
// 1, return a list of jobs filtered by job level and keywords, with pagination support
// 2, return the total number of jobs matching the filter criteria
// 3, return job number at each experience level
// 4, return the total number of jobs listed each month
// 5, return the number of jobs for each company, including only those with more than 10 postings
// 6, return a list of jobs that contain a specific keyword in their description
// 7, return statistics about how many jobs match a specific keyword
// ============================================================================================================

[ApiController]
[Route("api/jobs")]
public class JobController : ControllerBase
{
    private readonly NpgsqlConnection _conn;

    public JobController(NpgsqlConnection conn)
    {
        _conn = conn;
    }

    // return a list of jobs filtered by job level and keywords, with pagination support
    [HttpGet("list")]
    // if this endpoint returns a specific, predefined model, use ActionResult<T>
    // Use IActionResult for flexible responses like wrapping data in an object with metadata
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
            // the data type for keywords is List<string>
            // LINQ methods such as where and select are used to process the list, and convert each keyowrd into a SQL condition
            var keywordConds = keywords
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .Select((k, i) => $"LOWER(tech_tags) LIKE LOWER(@kw{i})")
                .ToList();
            whereConditions.Add("(" + string.Join(" AND ", keywordConds) + ")");
        }

        var whereClause = whereConditions.Count > 0
            ? "WHERE " + string.Join(" AND ", whereConditions)
            : "";

        // use CASE WHEN to count how many keywords each job matches
        // this will generate dynamic CASE statements based on the number of keywords provided
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

        var sql = @"
        SELECT 
            company_id, company_name, job_id, job_title, job_url, sub_id, sub_name,
            tech_tags as required_stacks,
            listed_date, location"
            // check if matchExpr is empty
        + (string.IsNullOrEmpty(matchExpr)
            ? "" // if empty, do not add anything
            : $", ({matchExpr}) AS match_count")
        + @"
        FROM jobs
        " + // add where clause to filter only results that match the target keywords and job level
        whereClause + @"
        ORDER BY "
        + (string.IsNullOrEmpty(matchExpr)
            ? "listed_date DESC NULLS LAST"
            : "match_count DESC, listed_date DESC NULLS LAST")
        + @"
        OFFSET @offset LIMIT @limit";
        // offset mean skip the first N records, limit means return at most N records

        await using var cmd = new NpgsqlCommand(sql, _conn);

        // calculate offset to skip records from previous pages, if page is 1, offset is 0, mean no records are skipped
        // if page is 2, offset is 20, mean the first 20 records are skipped, because they are on page 1
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

        // readasync returns true if there is a row to read, so the loop continues until all rows are read
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

        // determine if there are still more records to fetch, if the number of jobs returned equals the page size, it means there might be more records
        bool hasMore = jobs.Count == size; 
        return Ok(new { jobs, hasMore });
    }




    // return jobs that contain the specified keyword in their description
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

    // this endpoint returns data about how many jobs match a specific keyword entered by the user
    [HttpGet("search/stats")]
    public async Task<IActionResult> GetKeywordMatchStats([FromQuery] string keyword)
    {
        if (string.IsNullOrWhiteSpace(keyword))
            return BadRequest("Keyword is required.");

        await _conn.OpenAsync();

        // an object is a single instance of a data structure, usually matching one class on the backend, while an array is a list of such objects
        var stats = new List<LevelMatchStats>();

        // first, count the total number of jobs
        const string allJobsSql = @"SELECT COUNT(*) FROM jobs;";
        int allJobs = 0;
        await using (var cmd = new NpgsqlCommand(allJobsSql, _conn))
        {
            allJobs = Convert.ToInt32(await cmd.ExecuteScalarAsync());
        }

        // then, count how many jobs match the keyword, only support 1 keyword per request for now
        const string allMatchesSql = @"
            SELECT COUNT(*) 
            FROM jobs 
            WHERE to_tsvector('english', job_des) @@ plainto_tsquery('english', @kw)";

        int allMatches = 0;
        await using (var cmd = new NpgsqlCommand(allMatchesSql, _conn))
        {
            cmd.Parameters.AddWithValue("kw", keyword);
            allMatches = Convert.ToInt32(await cmd.ExecuteScalarAsync());
        }

        double allJobsPercentage = allJobs > 0
            ? Math.Round(allMatches * 100.0 / allJobs, 2)
            : 0.0;

        stats.Add(new LevelMatchStats{
            Level = "All",
            MatchCount = allMatches,
            Percentage = allJobsPercentage
        });

        // count the total number of jobs at each experience level
        // TODO : create a table to store number of jobs by level to avoid counting every time
        const string levelJobsSql = @"
        SELECT job_level, COUNT(*) AS TotalCount
        FROM jobs
        GROUP BY job_level;";

        var levelJobsDict = new Dictionary<string, int>();

        await using (var cmd = new NpgsqlCommand(levelJobsSql, _conn))
        {
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var level = reader["job_level"].ToString();
                var total = Convert.ToInt32(reader["TotalCount"]);
                levelJobsDict[level] = total;
            }
        }

        // count how many jobs match the keyword at each experience level
        const string levelJobsMatchSql = @"
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

        await using (var cmd = new NpgsqlCommand(levelJobsMatchSql, _conn))
        {
            cmd.Parameters.AddWithValue("kw", keyword);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var level = reader["job_level"].ToString();
                var matchCount = Convert.ToInt32(reader["MatchCount"]);
                var percentage = levelJobsDict.ContainsKey(level) && levelJobsDict[level] > 0
                    ? Math.Round(matchCount * 100.0 / levelJobsDict[level], 2)
                    : 0.0;

                stats.Add(new LevelMatchStats
                {
                    Level = level,
                    MatchCount = matchCount,
                    Percentage = percentage
                });
            }
        }

        await _conn.CloseAsync();
        return Ok(stats);
    }
}
