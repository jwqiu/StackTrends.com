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
}
