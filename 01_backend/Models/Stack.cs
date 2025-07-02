
public class TechStack
{
    public int Id { get; set; }
    public string? Category { get; set; }   // 可空，防止null
    public required string StackName { get; set; }  
    public string? NormalizedStackName { get; set; }
}

