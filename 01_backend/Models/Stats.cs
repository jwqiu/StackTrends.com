namespace StackTrends.Models
{
    public class LandingSummary
    {
        public int JobsCount { get; set; }
        public int CompanyCount { get; set; }
        public int KeywordCount { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
    
    public sealed class JobCountByMonthDto
    {
        public string YearMonth { get; set; } = "";  // e.g. "2025/04"
        public int Count { get; set; }
    }

    public class JobCountByLevelDto
    {
        public string Level { get; set; } = default!;   // e.g. "Senior", "Junior"…
        public int Count { get; set; }              // 该级别下的职位总数
    }

    // This class is not currently used.
    public class ExperienceLevelCount
    {
        public string Level { get; set; } = default!;
        public int Mentions { get; set; }
        public double Percentage { get; set; }
    }

    public class JobCountByCompany
    {
        public int Company_Id { get; set; }
        public int Jobs_Count { get; set; }
        public string? Company_name { get; set; }
    }
}