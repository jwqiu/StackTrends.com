namespace StackTrends.Models
{
    public class TechStackCount
    {
        public string? Technology { get; set; }
        public string? Category { get; set; }
        public int Mentions { get; set; }
        public double Percentage { get; set; }
    }

    public class ExperienceLevelCount
    {
        public string  Level      { get; set; } = default!;
        public int     Mentions   { get; set; }
        public double  Percentage { get; set; }
    }
}
