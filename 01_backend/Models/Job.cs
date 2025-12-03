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

        public string? JobLocation { get; set; } // 工作地点
    }

    // TODO: the KeywordMatchStats and LevelMatchStats classes could be combined into a single class 
    // public class KeywordMatchStats
    // {
    //     public int TotalJobs { get; set; }
    //     public int TotalMatches { get; set; }
    //     public double OverallPercentage { get; set; }
    //     public List<LevelMatchStats> LevelBreakdown { get; set; } = new();
    // }

    public class LevelMatchStats
    {
        public string Level { get; set; } = "";
        public int MatchCount { get; set; }
        public double Percentage { get; set; }
    }


    // public class KeywordsCount
    // {
    //     public int Count { get; set; }
    // }

}


