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
                company_id, company_name, job_id, job_title, job_url, sub_id, sub_name, ""Tech Tags"" as required_stacks
            FROM job_list_0415";

        await using var cmd = new NpgsqlCommand(sql, _conn);
        await using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            var job = new Job
            {
                JobId = Convert.ToInt32(reader["job_id"]), // 必须有值
                JobTitle = reader["job_title"].ToString(), // 必须有值

                CompanyId = reader["company_id"] == DBNull.Value ? (int?)null : Convert.ToInt32(reader["company_id"]),
                CompanyName = reader["company_name"] == DBNull.Value ? null : reader["company_name"].ToString(),
                JobUrl = reader["job_url"] == DBNull.Value ? null : reader["job_url"].ToString(),
                SubId = reader["sub_id"] == DBNull.Value ? (int?)null : Convert.ToInt32(reader["sub_id"]),
                SubName = reader["sub_name"] == DBNull.Value ? null : reader["sub_name"].ToString(),
                RequiredStacks = (reader["required_stacks"] == DBNull.Value ? "" : reader["required_stacks"].ToString())
                    .Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(s => s.Trim())
                    .ToList()
            };

            jobs.Add(job);
        }

        await _conn.CloseAsync();
        return Ok(jobs);
    }
}

