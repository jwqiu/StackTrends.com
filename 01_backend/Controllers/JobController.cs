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
    public async Task<IActionResult> GetAllJobs()

    {
        var jobs = new List<Job>();

        await _conn.OpenAsync();

        var sql = @"
            SELECT 
                company_id, company_name, job_id, job_title, job_url, sub_id, sub_name, tech_tags as required_stacks,
                listed_date
            FROM jobs";

        await using var cmd = new NpgsqlCommand(sql, _conn);
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
                ListedDate = reader["listed_date"] == DBNull.Value ? (DateTime?)null : Convert.ToDateTime(reader["listed_date"])
            };

            jobs.Add(job);
        }

        await _conn.CloseAsync();

        var sortedJobs = jobs
        .OrderByDescending(j => j.ListedDate ?? DateTime.MinValue)
        .ToList();

        return Ok(sortedJobs);
    }

    [HttpGet("count")]
    public async Task<IActionResult> JobsCount()
    {
        await _conn.OpenAsync();

        var sql = "SELECT COUNT(*) FROM jobs";
        await using var cmd = new NpgsqlCommand(sql, _conn);
        var count = Convert.ToInt32(await cmd.ExecuteScalarAsync());

        await _conn.CloseAsync();
        return Ok(new { count });
    }
}

