using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using Npgsql;
using StackTrends.Models;


// ===============================================================================================================================================================
// there is only 1 endpoint in this controller, which is to get the total number of unique companies from the jobs data
// however, this endpoint is no longer used after adding the landing summary API in stats controller 
// ===============================================================================================================================================================

namespace StackTrends.Controllers
{
    [ApiController]
    [Route("api/companies")]
    public class CompaniesController : ControllerBase
    {

        private readonly NpgsqlConnection _conn;

        public CompaniesController(NpgsqlConnection conn)
        {
            _conn = conn;
        }

        // this endpoint previously returned the total number of unique companies and displayed it on the landing page
        // however, it is no longer used after adding the landing summary API
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
}