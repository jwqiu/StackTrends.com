using Npgsql;
using Microsoft.AspNetCore.Mvc;
using StackTrends.Models;
using Microsoft.AspNetCore.Authorization;

[ApiController]
[Route("api/[controller]")]
public class CategoryController : ControllerBase
{

    private readonly NpgsqlConnection _conn;

    public CategoryController(NpgsqlConnection conn)
    {
        _conn = conn;
    }

    [HttpGet]
    public async Task<IEnumerable<Category>> GetAllCategories()
    {
        var categories = new List<Category>();

        await _conn.OpenAsync();
        // 把 name 和 group_name 一起查出来
        using var cmd = new NpgsqlCommand(
            @"SELECT id, name, group_name
            FROM category
            ORDER BY id", _conn);
        using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            categories.Add(new Category
            {
                Id        = reader.GetInt32(0),
                Name      = reader.GetString(1),
                GroupName = reader.GetString(2)
            });
        }
        await _conn.CloseAsync();

        return categories;
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> AddCategory([FromBody] Category category)
    {
        // 校验
        if (category == null
            || string.IsNullOrWhiteSpace(category.Name)
            || string.IsNullOrWhiteSpace(category.GroupName))
        {
            return BadRequest("Name 和 GroupName 都不能为空。");
        }

        await _conn.OpenAsync();
        try
        {
            const string sql = @"
                INSERT INTO public.category (name, group_name)
                VALUES (@name, @group_name)";
            await using var cmd = new NpgsqlCommand(sql, _conn);
            cmd.Parameters.AddWithValue("name", category.Name);
            cmd.Parameters.AddWithValue("group_name", category.GroupName);
            await cmd.ExecuteNonQueryAsync();
        }
        finally
        {
            await _conn.CloseAsync();
        }

        return Ok("Category added successfully.");
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        await _conn.OpenAsync();
        try
        {
            using var cmd = new NpgsqlCommand(
                "DELETE FROM category WHERE id = @id", _conn);
            cmd.Parameters.AddWithValue("id", id);

            var rows = await cmd.ExecuteNonQueryAsync();
            if (rows == 0)
                return NotFound($"No category with id={id}.");

            return NoContent();  // 204
        }
        finally
        {
            await _conn.CloseAsync();
        }
    }


    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] Category dto)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest("Invalid payload.");

        await _conn.OpenAsync();
        try
        {
            using var cmd = new NpgsqlCommand(
                "UPDATE category SET name = @name, group_name = @group WHERE id = @id",
                _conn);
            cmd.Parameters.AddWithValue("name", dto.Name);
            cmd.Parameters.AddWithValue("group", dto.GroupName);
            cmd.Parameters.AddWithValue("id", id);

            var rows = await cmd.ExecuteNonQueryAsync();
            if (rows == 0)
                return NotFound($"Category with id={id} not found.");

            return NoContent();  // 204
        }
        finally
        {
            await _conn.CloseAsync();
        }
    }

}