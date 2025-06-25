using Microsoft.AspNetCore.Mvc.Routing;

namespace StackTrends.Models
{
    public class Job
    {
        public int JobId { get; set; }
        public required string JobTitle { get; set; }

        public int? CompanyId { get; set; }
        public string? CompanyName { get; set; }

        public DateTime? PostedDate { get; set; }

        public List<string>? RequiredStacks { get; set; }

        public string? JobUrl { get; set; } // 或自定义结构

        public string? JobDescription { get; set; }

        public int? SubId { get; set; }
        public string? SubName { get; set; }

        public DateTime? ListedDate { get; set; } // 可选，可能不需要
    }

    public class JobCountByLevelDto
    {
        public string Level { get; set; } = default!;   // e.g. "Senior", "Junior"…
        public int Count     { get; set; }              // 该级别下的职位总数
    }

	
}


