namespace StackTrends.Models
{
    // this class is currently not in use
    public class TechTrendPoint
    {
        public required string Month { get; set; }       // 对应数据库的 month
        public required string Technology { get; set; }  // 对应数据库的 tech
        public required double Percentage { get; set; }  // 对应数据库的 mention_rate
        public required string TrendType { get; set; }   // growing / declining
    }

}
