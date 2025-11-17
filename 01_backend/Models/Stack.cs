namespace StackTrends.Models
{
    public class TechSkill
    {
        public int Id { get; set; }
        public string? Category { get; set; }   // 可空，防止null
        public required string StackName { get; set; }  
        public string? NormalizedStackName { get; set; }
    }

    public class TechSkillRankByCompany
    {
        public long Company_Id     { get; set; }
        public string? Company_Name { get; set; }
        public string Category     { get; set; }
        public string Technology   { get; set; }
        public int Mentions        { get; set; }
        public decimal Percentage  { get; set; }
    }

    public class TechSkillRank
    {
        public string? Level { get; set; }        // e.g. "Senior"
        public string? Technology { get; set; }
        public string? Category { get; set; }
        public int Mentions { get; set; }
        public double Percentage { get; set; }
    }
}