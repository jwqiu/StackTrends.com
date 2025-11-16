namespace StackTrends.Models
{
    public class TechStackCount
    {
        public string? Level { get; set; }        // e.g. "Senior"
        public string? Technology { get; set; }
        public string? Category { get; set; }
        public int Mentions { get; set; }
        public double Percentage { get; set; }
    }

    public class ExperienceLevelCount
    {
        public string Level { get; set; } = default!;
        public int Mentions { get; set; }
        public double Percentage { get; set; }
    }

    // public class TechStackByLevel
    // {
    //     public string Level { get; set; }        // e.g. "Senior"
    //     public string Category { get; set; }     // e.g. "Frontend"
    //     public string Technology { get; set; }   // e.g. "React"
    //     public int Mentions { get; set; }        // 该等级该类别该技术栈被提及次数
    //     public double Percentage { get; set; }   // Mentions / 该等级总职位数 * 100
    // }
    public class KeywordMatchResult
    {
        public int TotalJobs { get; set; }
        public int TotalMatches { get; set; }
        public double OverallPercentage { get; set; }
        public List<LevelMatch> LevelBreakdown { get; set; } = new();
    }

    public class LevelMatch
    {
        public string Level { get; set; } = "";
        public int MatchCount { get; set; }
        public double Percentage { get; set; }
    }

    public class CompaniesCount
    {
        public int Company_Id { get; set; }
        public int Jobs_Count { get; set; }
        public string? Company_name { get; set; }
    }

    public class KeywordsCount
    {
        public int Count { get; set; }
    }

    // public class LandingSummary
    // {
    //     public int JobsCount { get; set; }
    //     public int CompanyCount { get; set; }
    //     public int KeywordCount { get; set; }
    //     public DateTime UpdatedAt { get; set; }
    // }

    public class TechTrend
    {
        public required string Month { get; set; }       // 对应数据库的 month
        public required string Technology { get; set; }  // 对应数据库的 tech
        public required double Percentage { get; set; }  // 对应数据库的 mention_rate
        public required string TrendType { get; set; }   // growing / declining
    }

}
