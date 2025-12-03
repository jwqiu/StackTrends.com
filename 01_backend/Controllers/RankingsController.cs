using Npgsql;
using Microsoft.AspNetCore.Mvc;
using StackTrends.Models;
using Microsoft.AspNetCore.Authorization;

namespace StackTrends.Controllers
{
    [ApiController]
    [Route("api/rankings")]
    public class RankingsController : ControllerBase
    {
        private readonly NpgsqlConnection _conn;

        public RankingsController(NpgsqlConnection conn)
        {
            _conn = conn;
        }
        
        // this endpoint returns the tech skills ranking for each company(top N companies by job count)
        [HttpGet("by-company")]
        public async Task<ActionResult<IEnumerable<TechSkillRankByCompany>>> GetTechStackRank(
        [FromQuery] int? companyLimit = null)

        {   
            // if companyLimit is provided, select only top N companies by job count and then get their tech stack ranking, otherwise get the tech stack ranking for all companies with more than 10 job postings
            // the table tech_stack_rank_by_company already has the tech stack ranking for companies with more than 10 job postings
            var sql = companyLimit.HasValue
            ? @"
                WITH top_companies AS (
                    SELECT company_id, jobs_count
                    FROM public.job_counts_by_company
                    ORDER BY jobs_count DESC
                    LIMIT @companyLimit
                )
                SELECT t.company_id, t.company_name, t.category, t.technology, t.mentions, t.percentage
                FROM public.tech_stack_rank_by_company t
                JOIN top_companies c ON c.company_id = t.company_id
                ORDER BY c.jobs_count DESC, t.company_id, t.category, t.mentions DESC;"
            : @"
                SELECT t.company_id, t.company_name, t.category, t.technology, t.mentions, t.percentage
                FROM public.tech_stack_rank_by_company t
                LEFT JOIN public.job_counts_by_company jc ON jc.company_id = t.company_id
                ORDER BY COALESCE(jc.jobs_count,0) DESC, t.company_id, t.category, t.mentions DESC;
            ";


            var result = new List<TechSkillRankByCompany>();

            await _conn.OpenAsync();
            using var cmd = new NpgsqlCommand(sql, _conn);
            if (companyLimit.HasValue)
                cmd.Parameters.AddWithValue("companyLimit", companyLimit.Value);
            using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {   
                // backend property names are written in PascalCase to match C# conventions, which mean the first letter of each word is capitalized
                // ASP.NET Core converts them to camelCase automatically when returning JSON responses, so the first letter of the first word is lowercase
                // so frontend can use camelCase to access these properties directly
                // the naming convention in C# is to use PascalCase for class names and properties, and camelCase for local variables and method parameters
                // please note that the convention in JavaScript is to use camelCase for both variable names and property names
                result.Add(new TechSkillRankByCompany
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

        // this endpoint returns the overall tech skills ranking , support filtering by job level
        [HttpGet("by-level")]
        public async Task<IEnumerable<TechSkillRank>> GetCounts([FromQuery] string level = "all")
        {
            var counts = new List<TechSkillRank>();

            await _conn.OpenAsync();

            // base SQL query
            var sql = @"
                SELECT job_level, category, technology, mentions, percentage
                FROM tech_stacks_frequency_count
            ";

            // add WHERE clause if a specific level is requested
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
                counts.Add(new TechSkillRank
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

    }
}