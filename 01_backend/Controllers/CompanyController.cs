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
    public async Task<ActionResult<IEnumerable<CompaniesCount>>> GetCompanyJobCountRawSql()
    {
        var result = new List<CompaniesCount>();

        var sql = @"
            SELECT 
                company_id, 
                COUNT(*) AS jobs_count, 
                company_name
            FROM 
                public.jobs
            GROUP BY 
                company_id, company_name
            ORDER BY 
                jobs_count DESC;
        ";

        await _conn.OpenAsync();

        using var cmd = new NpgsqlCommand(sql, _conn);
        using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            result.Add(new CompaniesCount
            {
                Company_Id = reader.GetInt32(0),
                Jobs_Count = reader.GetInt32(1),
                Company_name = reader.IsDBNull(2) ? null : reader.GetString(2)
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


}
