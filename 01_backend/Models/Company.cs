namespace StackTrends.Models
{
    public class TechStackRankByCompany
    {
        public long Company_Id     { get; set; }
        public string? Company_Name { get; set; }
        public string Category     { get; set; }
        public string Technology   { get; set; }
        public int Mentions        { get; set; }
        public decimal Percentage  { get; set; }
    }
}