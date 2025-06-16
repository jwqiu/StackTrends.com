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
        var sql = @"SELECT id, category, stack_name FROM tech_stacks_list";
        await using var cmd = new NpgsqlCommand(sql, _conn);
        await using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            list.Add(new TechStack
            {
                Id = Convert.ToInt32(reader["id"]),
                Category = reader["category"] == DBNull.Value ? null : reader["category"].ToString(),
                StackName = reader["stack_name"] == DBNull.Value ? null : reader["stack_name"].ToString(),
            });
        }

        await _conn.CloseAsync();
        return list;
    }
}
