using Npgsql;
using Microsoft.AspNetCore.Mvc;
using StackTrends.Models;


[ApiController]
[Route("api/[controller]")]
public class TechStackController : ControllerBase
{
    private readonly NpgsqlConnection _conn;

    public TechStackController(NpgsqlConnection conn)
    {
        _conn = conn;
    }

    [HttpGet("all")]
    public async Task<IEnumerable<TechStack>> GetAllTechStacks()
    {
        var list = new List<TechStack>();
        await _conn.OpenAsync();
        var sql = @"
        SELECT id, category, raw_keyword, normalized_keyword
        FROM tech_stacks_list
        ORDER BY id ASC, category ASC";

        await using var cmd = new NpgsqlCommand(sql, _conn);
        await using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            list.Add(new TechStack
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
    public async Task<IActionResult> AddTechStack([FromBody] TechStack stack)
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

        // 只返回 204 No Content，告诉前端“操作成功”，前端自行再去 GET /all 刷新列表
        return NoContent();
    }

    [HttpDelete("delete/{id}")]
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
    public async Task<IActionResult> UpdateTechStack(int id, [FromBody] TechStack stack)
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
        cmd.Parameters.AddWithValue("category", stack.Category   ?? (object)DBNull.Value);
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

    [HttpGet("normalize")]
    public async Task<IActionResult> NormalizeKeyword([FromQuery] string keyword)
    {
        await _conn.OpenAsync();

        // 1) 精确找 normalized
        var sql1 = @"
            SELECT normalized_keyword 
            FROM tech_stacks_list 
            WHERE LOWER(raw_keyword) = LOWER(@kw)
            LIMIT 1";
        await using var cmd1 = new NpgsqlCommand(sql1, _conn);
        cmd1.Parameters.AddWithValue("kw", keyword);
        var normObj = await cmd1.ExecuteScalarAsync();

        string? normalized = normObj != null && normObj != DBNull.Value
            ? normObj.ToString()!
            : null;
        if (string.IsNullOrWhiteSpace(normalized))
        {
            normalized = null; // 确保 normalized 是 null 而不是空字符串
        }
        // 2) 如果没找到，再模糊匹配 raw_keyword
        if (normalized == null)
        {
            var sql2 = @"
                SELECT raw_keyword 
                FROM tech_stacks_list 
                WHERE LOWER(raw_keyword) LIKE LOWER('%' || @kw || '%')
                LIMIT 1";
            await using var cmd2 = new NpgsqlCommand(sql2, _conn);
            cmd2.Parameters.AddWithValue("kw", keyword);
            var rawObj = await cmd2.ExecuteScalarAsync();
            normalized = rawObj != null && rawObj != DBNull.Value
                ? rawObj.ToString()!
                : keyword;
        }

        await _conn.CloseAsync();
        return Ok(new { normalized });
    }
}
