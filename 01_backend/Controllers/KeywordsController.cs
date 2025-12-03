using Npgsql;
using Microsoft.AspNetCore.Mvc;
using StackTrends.Models;
using Microsoft.AspNetCore.Authorization;

// ============================================================================================================
// there are 8 endpoints in this controller related to tech keywords management and ranking
// 1, there are 6 endpoints to manage the tech keywors, including: get all tech keywords, add a new keyword, delete, update, normalize a keyword and get the total number of existing keywords
// 2, there are 2 endpoints to get the tech skills ranking, ranking by overall mentions and ranking by each company (might be merged into 1 endpoint later)
// ============================================================================================================
namespace StackTrends.Controllers
{
    [ApiController]
    [Route("api/keywords")]
    public class KeywordsController : ControllerBase
    {
        private readonly NpgsqlConnection _conn;

        public KeywordsController(NpgsqlConnection conn)
        {
            _conn = conn;
        }
        
        // return all existing tech skill keywords from the database
        [HttpGet("list")]
        public async Task<IEnumerable<TechSkill>> GetAllTechStacks()
        {
            var list = new List<TechSkill>();
            await _conn.OpenAsync();
            var sql = @"
            SELECT id, category, raw_keyword, normalized_keyword
            FROM tech_stacks_list
            ORDER BY id ASC, category ASC";

            await using var cmd = new NpgsqlCommand(sql, _conn);
            await using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                list.Add(new TechSkill
                {
                    Id = Convert.ToInt32(reader["id"]),
                    Category = reader["category"] == DBNull.Value ? null : reader["category"].ToString(),
                    StackName = reader["raw_keyword"] == DBNull.Value ? null : reader["raw_keyword"].ToString(),
                    NormalizedStackName = reader["normalized_keyword"] == DBNull.Value ? null : reader["normalized_keyword"].ToString()
                });
            }

            await _conn.CloseAsync();
            return list;
        }

        [HttpPost("add")]
        [Authorize]
        public async Task<IActionResult> AddTechStack([FromBody] TechSkill stack)
        {
            await _conn.OpenAsync();
            var sql = @"
                INSERT INTO tech_stacks_list (category, raw_keyword, normalized_keyword)
                VALUES (@category, @rawKeyword, @normalizedKeyword);";
            await using var cmd = new NpgsqlCommand(sql, _conn);
            cmd.Parameters.AddWithValue("category", stack.Category ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("rawKeyword", stack.StackName ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("normalizedKeyword", stack.NormalizedStackName ?? (object)DBNull.Value);
            await cmd.ExecuteNonQueryAsync();
            await _conn.CloseAsync();

            // return 204 to indicate the addition was successful with no content to return
            return NoContent();
        }

        [HttpDelete("delete/{id}")]
        [Authorize]
        public async Task<IActionResult> DeleteTechStack(int id)
        {
            await _conn.OpenAsync();

            var sql = @"
                DELETE FROM tech_stacks_list
                WHERE id = @id;
            ";

            await using var cmd = new NpgsqlCommand(sql, _conn);
            cmd.Parameters.AddWithValue("id", id);

            var affected = await cmd.ExecuteNonQueryAsync();
            await _conn.CloseAsync();

            if (affected > 0)
                // 删除成功，不返回内容
                return NoContent();      // HTTP 204
            else
                // 如果找不到该记录，返回 404
                return NotFound();       // HTTP 404
        }

        [HttpPut("update/{id}")]
        [Authorize]
        public async Task<IActionResult> UpdateTechStack(int id, [FromBody] TechSkill stack)
        {
            await _conn.OpenAsync();

            var sql = @"
                UPDATE tech_stacks_list
                SET category           = @category,
                    raw_keyword        = @rawKeyword,
                    normalized_keyword = @normalizedKeyword
                WHERE id = @id;
            ";

            await using var cmd = new NpgsqlCommand(sql, _conn);
            cmd.Parameters.AddWithValue("category", stack.Category ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("rawKeyword", stack.StackName ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("normalizedKeyword", stack.NormalizedStackName ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("id", id);

            var affected = await cmd.ExecuteNonQueryAsync();
            await _conn.CloseAsync();

            if (affected > 0)
                return NoContent();  // 更新成功，204 No Content
            else
                return NotFound();   // 没有找到该 ID，404 Not Found
        }

        // this endpoint receives a keyword from the frontend and returns its normalized name if it is already predefined in the database
        // first, we check if the input keyword already exists in our normalized keyword list/column; if so, we simply return the original keyword
        // if not, we then check if it exists in the raw keyword list/column, if so, we return its corresponding normalized keyword.
        // and if isn't found in either column/list, we just return the original keyword
        [HttpGet("normalize")]
        public async Task<IActionResult> NormalizeKeyword([FromQuery] string keyword)
        {
            await _conn.OpenAsync();

            // first, check whether the keyword matches any value in the normalized_keyword column; if so, return the original keyword
            var sql1 = @"
                SELECT normalized_keyword 
                FROM tech_stacks_list 
                WHERE LOWER(normalized_keyword) = LOWER(@kw)
                LIMIT 1";
            await using var cmd1 = new NpgsqlCommand(sql1, _conn);
            cmd1.Parameters.AddWithValue("kw", keyword.ToLower());
            var normObj = await cmd1.ExecuteScalarAsync();

            if (normObj != null && normObj != DBNull.Value)
            {
                await _conn.CloseAsync();
                // 命中 normalized_keyword，直接用原词返回
                return Ok(new { normalized = keyword });
            }

            // if not, check whether it matches any value in the raw_keyword column
            // if matched, return the normalized keyword if it exists; otherwise return the raw_keyword
            var sql2 = @"
                SELECT normalized_keyword, raw_keyword
                FROM tech_stacks_list
                WHERE LOWER(raw_keyword) = LOWER(@kw)
                LIMIT 1";
            await using var cmd2 = new NpgsqlCommand(sql2, _conn);
            cmd2.Parameters.AddWithValue("kw", keyword.ToLower());
            await using var reader = await cmd2.ExecuteReaderAsync();

            string? normalized = null;
            if (await reader.ReadAsync())
            {   
                // use normalized_keyword first if it exists
                if (!(reader["normalized_keyword"] is DBNull) && !string.IsNullOrWhiteSpace(reader["normalized_keyword"].ToString()))
                {
                    normalized = reader["normalized_keyword"].ToString();
                }
                else
                {
                    normalized = reader["raw_keyword"].ToString();
                }
                await _conn.CloseAsync();
                return Ok(new { normalized });
            }

            // if the keyword doesn't match any value in either column, return the original keyword
            await _conn.CloseAsync();
            return Ok(new { normalized = keyword });
        }

        // count and return the total number of existing tech keywords
        // this endpoint is no longer used after adding the landing summary API
        [HttpGet("count")]
        public async Task<ActionResult<object>> GetRawKeywordTotalCount()
        {
            var sql = @"
                SELECT COUNT(raw_keyword)
                FROM public.tech_stacks_list;
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