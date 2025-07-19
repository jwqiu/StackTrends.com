using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using Npgsql;
using StackTrends.Models;


[ApiController]
[Route("api/companies")]
public class CompaniesController : ControllerBase
{

    private readonly NpgsqlConnection _conn;

    public CompaniesController(NpgsqlConnection conn)
    {
        _conn = conn;
    }

    [HttpGet("jobs-count")]
    public async Task<ActionResult<IEnumerable<CompaniesCount>>> GetTop20CompaniesByJobCount()
    {
        const string sql = @"
            SELECT company_id, company_name, jobs_count
            FROM public.job_counts_by_company
            ORDER BY jobs_count DESC
            LIMIT 20;
        ";

        var result = new List<CompaniesCount>();

        await _conn.OpenAsync();
        using var cmd    = new NpgsqlCommand(sql, _conn);
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            result.Add(new CompaniesCount
            {
                Company_Id     = (int)reader.GetInt64(0),
                Company_name   = reader.IsDBNull(1) ? null : reader.GetString(1),
                Jobs_Count     = (int)reader.GetInt64(2)
            });
        }
        await _conn.CloseAsync();

        return Ok(result);
    }

    [HttpGet("count")]
    public async Task<ActionResult<object>> GetCompanyTotalCount()
    {
        var sql = @"
            SELECT COUNT(DISTINCT company_id) 
            FROM public.jobs;
        ";

        await _conn.OpenAsync();

        using var cmd = new NpgsqlCommand(sql, _conn);
        var result = await cmd.ExecuteScalarAsync();
        var count = Convert.ToInt32(result ?? 0);

        await _conn.CloseAsync();

        return Ok(new { count });
    }

    [HttpGet("tech-stack-rank")]
    public async Task<ActionResult<IEnumerable<TechStackRankByCompany>>> GetTechStackRank()
    {
        var sql = @"
            SELECT 
                company_id,
                company_name,
                category,
                technology,
                mentions,
                percentage
            FROM public.tech_stack_rank_by_company
            ORDER BY company_id, category, mentions DESC
        ";

        var result = new List<TechStackRankByCompany>();

        await _conn.OpenAsync();
        using var cmd    = new NpgsqlCommand(sql, _conn);
        using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            result.Add(new TechStackRankByCompany
            {
                Company_Id     = reader.GetInt64(0),
                Company_Name   = reader.IsDBNull(1) ? null : reader.GetString(1),
                Category       = reader.IsDBNull(2) ? null : reader.GetString(2),
                Technology     = reader.IsDBNull(3) ? null : reader.GetString(3),
                Mentions       = reader.GetInt32(4),
                Percentage     = reader.GetDecimal(5)
            });
        }
        await _conn.CloseAsync();

        return Ok(result);
    }


}
