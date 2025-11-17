using Npgsql;
using Microsoft.AspNetCore.Mvc;
using StackTrends.Models;
using Microsoft.AspNetCore.Authorization;

// ===============================================================================================================================================================
// there are 4 endpoints for category management in this controller: create, update, delete, and get a list of all category keywords
// each tech keyword belongs to a specific category, and some categories are further grouped into broader groups, like, coding skills, tools and platforms, etc.
// ===============================================================================================================================================================

[ApiController]
[Route("api/categories")]
public class CategoryController : ControllerBase
{
    // declare a private readonly variable to hold the database connection
    // cause this controller needs to interact with the database to manage categories data
    private readonly NpgsqlConnection _conn;

    // assign the database connection instance registered in Program.cs to the previously declared _conn variable through dependency injection in the constructor
    public CategoryController(NpgsqlConnection conn)
    {
        _conn = conn;
    }

    // this endpoint handles requests to get all categories from the database
    [HttpGet]
    public async Task<IEnumerable<Category>> GetAllCategories()
    {
        // use the default constructor to create an empty list to hold the categories retrieved from the database
        var categories = new List<Category>();

        // use the variable declared above to open the database connection asynchronously
        await _conn.OpenAsync();

        // using just means 'use it and clean it up automatically when you are done', it helps release things like database connections so our program doesn't get stuck
        using var cmd = new NpgsqlCommand(
            @"SELECT id, name, group_name
            FROM category
            ORDER BY id", _conn);
        using var reader = await cmd.ExecuteReaderAsync();

        // read each row returned by the database query
        // while means 'as long as there is something to read, keep going'
        while (await reader.ReadAsync())
        {
            // for each row, create a new category object and add it to the categories list we created earlier
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
    // this attribute means only logged-in users can access this endpoint
    // once we register AddAuthentication and AddAuthorization in Program.cs, ASP.NET Core will automatically check for any [Authorize] attributes on our controllers and require the user to be authenticated before allowing access
    [Authorize]
    // IActionResult is an interface that represents an HTTP response
    public async Task<IActionResult> AddCategory([FromBody] Category category)
    {
        // first check if the object received from the request body is null, if not, check whether the fields are empty or not
        if (category == null
            || string.IsNullOrWhiteSpace(category.Name)
            || string.IsNullOrWhiteSpace(category.GroupName))
        {
            return BadRequest("Name and GroupName are required, can not be empty");
        }

        await _conn.OpenAsync();

        try
        {
            const string sql = @"
                INSERT INTO public.category (name, group_name)
                VALUES (@name, @group_name)";
            // right side await waits for the async operation to complete, left side await using waits for the resource to be disposed of after use
            // Most SQL operations require right-side await; left-side await using is usually unnecessary.
            await using var cmd = new NpgsqlCommand(sql, _conn);
            cmd.Parameters.AddWithValue("name", category.Name);
            cmd.Parameters.AddWithValue("group_name", category.GroupName);
            await cmd.ExecuteNonQueryAsync();
        }
        finally
        {
            await _conn.CloseAsync();
        }
        // OK is an HTTP 200 result class ; OK() creates a new HTTP 200 response object with the specified content
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

            // ExecuteNonQueryAsync is used for SQL commands that do not return any data, such as INSERT, UPDATE, DELETE, but it will return the number of rows affected by the command
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
    // category dto is the same as int id: type + variable name
    // DTO stands for Data Transfer Object, a common naming convention.
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

            // update successfully but return no data, so use 204 No Content, if returns data, use 200 OK
            return NoContent();  // 204
        }
        finally
        {
            await _conn.CloseAsync();
        }
    }

}