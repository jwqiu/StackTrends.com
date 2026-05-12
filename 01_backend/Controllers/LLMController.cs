using Microsoft.AspNetCore.Mvc;
using OpenAI.Chat;
using System.Text.Json;

[ApiController]
[Route("api/llm")]
public class LlmController : ControllerBase
{
    private readonly ChatClient _chatClient;

    public LlmController(ChatClient chatClient)
    {
        _chatClient = chatClient;
    }

    [HttpPost("analyze-job-description")]
    public async Task<IActionResult> AnalyzeJobDescription([FromBody] JobDescriptionRequest request)
    {   
        try
        {
            var messages = new List<ChatMessage>
            {
                new SystemChatMessage("""
                You analyze New Zealand IT job descriptions and return ONLY valid JSON.

                Extract exactly three fields:
                {
                "requiredSkills": [],
                "yearOfExperience": null,
                "jobLevel": ""
                }

                Field rules:

                1. requiredSkills
                Extract only specific, concrete tech stack items mentioned in the job description.

                A valid item should be a real technology, tool, platform, framework, library, database, cloud service, language, or software product that could realistically appear:
                - in a developer resume tech stack section
                - in a tech stack search filter
                - as a concrete technology keyword

                Include:
                - programming languages
                - frameworks and libraries
                - databases
                - cloud platforms/services
                - developer tools
                - design tools
                - testing tools
                - technical standards/protocols

                Do NOT include:
                - soft skills
                - responsibilities
                - methodologies
                - architecture concepts
                - engineering philosophies
                - security models
                - abstract technical concepts
                - quality attributes
                - general capability areas

                If a term describes a concept, practice, responsibility, or outcome rather than a specific technology, do not include it.

                Examples of valid tech stack items:
                ["Python", "React", "Azure", "PostgreSQL", "Docker", "Figma", "HTML5", "REST API"]

                Examples of invalid items:
                ["cloud-native architecture", "zero-trust security", "web performance", "SEO", "cross-browser compatibility", "accessibility", "technical documentation"]

                If a category is mentioned without a specific named technology, do not include it.

                Examples:
                - "modern web frameworks" -> do not include
                - "cloud platforms" -> do not include
                - "React and Vue" -> include ["React", "Vue"]

                2. yearOfExperience
                Extract the candidate's overall experience requirement as a number.

                Priority rules:
                - First, look for an overall/general professional experience requirement.
                - If an overall experience requirement exists, use that value.
                - If no overall experience requirement exists, use the most important technical/domain-specific experience requirement mentioned in the JD.

                Examples:
                - "5+ years of software development experience" -> 5
                - "3+ years of commercial experience building web applications" -> 3
                - "3 years of Python experience" -> 3 (if no overall experience requirement is mentioned)
                - "5 years overall experience and 2 years of React experience" -> 5

                If no experience requirement can be inferred, return null.

                3. jobLevel
                Classify the role level in the New Zealand IT job market.

                Must be exactly one of:
                "Junior"
                "Intermediate"
                "Senior"

                Decision priority:

                1. First, check whether the JD directly states the level.
                Examples:
                - junior
                - graduate
                - entry-level
                - intermediate
                - mid-level
                - senior
                - lead
                - principal

                2. If the level is not directly stated, infer primarily from the experience requirement:
                - 0-2 years -> Junior
                - 3-5 years -> Intermediate
                - 6+ years -> Senior

                3. If experience requirement is unclear or missing, infer from:
                - salary range
                - responsibilities
                - technical complexity
                - level of ownership
                - leadership or mentoring expectations

                Use common expectations in the New Zealand software engineering job market when making the decision.

                Examples:
                - independent system ownership, architecture decisions, mentoring others -> Senior
                - works under guidance with limited ownership -> Junior
                - contributes independently to features and projects without leadership responsibility -> Intermediate

                If uncertain, choose the most likely level based on the full JD.

                Example output:
                {
                "requiredSkills": ["Python", "SQL", "React", "Azure"],
                "yearOfExperience": 5,
                "jobLevel": "Senior"
                }

                Return JSON only.
                Do not return markdown.
                Do not include explanation.
                """),

                new UserChatMessage($"""
                Analyze this job description:

                {request.JobDescription}
                """)
            };

            var response = await _chatClient.CompleteChatAsync(messages);

            var analysisText = response.Value.Content[0].Text;

            var analysisResult = JsonSerializer.Deserialize<JobAnalysisResult>(analysisText);

            return Ok(new { analysis = analysisResult });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                error = ex.Message
            });
        }

    }
}

public class JobDescriptionRequest
{
    public string JobDescription { get; set; } = "";
}

public class JobAnalysisResult
{
    public List<string>? requiredSkills { get; set; } = new();

    public int? yearOfExperience { get; set; }

    public string jobLevel { get; set; } = "";
}