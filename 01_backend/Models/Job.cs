using Microsoft.AspNetCore.Mvc.Routing;

public class Job
{
    public int JobId { get; set; }
    public string JobTitle { get; set; }

    public int? CompanyId { get; set; }
    public string? CompanyName { get; set; }

    public DateTime? PostedDate { get; set; }

    public List<string>? RequiredStacks { get; set; }

    public string? JobUrl { get; set; } // 或自定义结构

    public string? JobDescription { get; set; }

    public int? SubId { get; set; }
    public string? SubName { get; set; }
}

	
