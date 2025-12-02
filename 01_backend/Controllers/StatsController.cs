using Npgsql;
using Microsoft.AspNetCore.Mvc;
using StackTrends.Models;


// ============================================================================================================
// This controller is responsible for providing general statistical data, such as the landing page summary.
// ============================================================================================================

namespace StackTrends.Controllers
{
    [ApiController]
    [Route("api/stats")]
    public class StatsController : ControllerBase

    {
        private readonly NpgsqlConnection _conn;

        public StatsController(NpgsqlConnection conn)
        {
            _conn = conn;
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

            // try to read the next row, returns true if there is a row to read
            if (await reader.ReadAsync())
            {   
                // create a new landing summary object and populate it with data from the database
                var summary = new LandingSummary
                {
                    JobsCount = Convert.ToInt32(reader["jobs_count"]),
                    CompanyCount = Convert.ToInt32(reader["company_count"]),
                    KeywordCount = Convert.ToInt32(reader["keyword_count"]),
                    UpdatedAt = Convert.ToDateTime(reader["updated_at"])
                };

                // close the database connection first, then return the summary object as the response
                // if we return before closing, all the code after the return statement won't be executed
                await _conn.CloseAsync();
                return Ok(summary);
            }

            await _conn.CloseAsync();
            return NotFound("No landing summary found.");
        }

        // return the total number of jobs matching the specified filters, such as job level and keywords
        [HttpGet("jobs/count")]
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

            // ExecuteScalarAsync is used to execute SQL commands that return a single value 
            var count = Convert.ToInt32(await cmd.ExecuteScalarAsync());

            await _conn.CloseAsync();
            return Ok(new { count });
        }

        [HttpGet("jobs/level")]
        public async Task<ActionResult<IEnumerable<JobCountByLevelDto>>> GetCountByLevel()
        {
            var list = new List<JobCountByLevelDto>();

            await _conn.OpenAsync();

            // first count all jobs, then count jobs by level, and combine the results
            // order by predefined level order: All, Senior, Intermediate, Junior, Others
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

        // this endpoint returns the total number of jobs listed each month
        [HttpGet("jobs/month")]
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
        [HttpGet("jobs/company")]
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

    }

}