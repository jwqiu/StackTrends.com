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
                "jobLevel": "",
                "jobLevelEvidence": []
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
                Extract the candidate's experience requirement and return it as a number.

                Priority rules:
                - First, look for an overall/general professional experience requirement.
                - If an overall experience requirement exists, use that value.
                - If no overall experience requirement exists, use the most important technical/domain-specific experience requirement mentioned in the JD.
                - If the JD mentions months of experience and it is less than 12 months, return 0.
                - If the JD does not mention any clear experience duration, return null.

                Examples:
                - "2+ years of professional experience" => 2
                - "At least 3 years of software development experience" => 3
                - "6 months of commercial experience" => 0
                - "Some experience with Python" => null
                - "Experience with React is preferred" => null

                If no experience requirement can be inferred, return null.

                3. jobLevel
                Classify the role level in the New Zealand IT job market.

                Must be exactly one of:
                "Junior"
                "Intermediate"
                "Senior"

                Decision priority:

                1) First, check whether the JD directly states the level.
                Examples:
                - junior
                - graduate
                - entry-level
                - intermediate
                - mid-level
                - senior
                - lead
                - principal

                2) If the level is not directly stated, infer primarily from the experience requirement:
                - 0-2 years -> Junior
                - 3-5 years -> Intermediate
                - 6+ years -> Senior

                3) If experience requirement is unclear or missing, infer from:
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

                4. jobLevelEvidence
                Return up to 3 pieces of evidence from the original job description that strongly support the jobLevel classification.

                Rules:
                - Each evidence item must be copied from the original job description.
                - Do not create new wording.
                - Do not explain the evidence.
                - Evidence can be:
                - a single word, such as "senior", "graduate", "lead"
                - a short phrase, such as "3 years experience"
                - part of a sentence
                - a short sentence fragment
                - Evidence does not need to be a full sentence.
                - Include the strongest evidence first.
                - Return fewer than 3 items if there are not enough strong evidence items.
                - If no clear evidence can be found, return an empty array.

                Good examples:
                - "senior"
                - "graduate developer"
                - "3+ years of commercial experience"
                - "mentor junior developers"
                - "own technical design decisions"
                - "work under the guidance of senior developers"

                Important:
                - The evidence must come directly from the original JD text.

                Example output:
                {
                "requiredSkills": ["Python", "SQL", "React", "Azure"],
                "yearOfExperience": 5,
                "jobLevel": "Senior",
                "jobLevelEvidence": ["5 years experience", "senior", "mentor junior developers"]
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

    [HttpPost("explain-tech-keyword")]
    public async Task<IActionResult> ExplainTechKeyword([FromBody] TechKeywordExplainRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Keyword))
        {
            return BadRequest(new
            {
                error = "Keyword is required."
            });
        }

        try
        {
            var keyword = request.Keyword.Trim();

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage("""
                You judge whether a tech keyword represents a practical and concrete software developer skill requirement.

                A practical and concrete developer skill requirement can be a technology, tool, platform, framework, programming language, database, coding practice, technical standard, or similar item that may reasonably appear in:
                - a job seeker's resume tech stack section
                - a software developer job description requirement

                Return ONLY valid JSON.

                Output format:
                {
                "keyword": "",
                "explanation": ""
                }

                Rules:
                - In the explanation, clearly say whether the answer is Yes or No.
                - Use Yes if the keyword represents a practical and concrete software developer skill requirement.
                - Use No if the keyword is too broad, abstract, business-oriented, vague, or not a specific developer skill.
                - Briefly explain why in simple English.
                - The explanation must be under 80 words.
                - Focus on software development, IT jobs, resume tech stack sections, and job description requirements.
                - Do not decide whether the keyword should be added to the database.
                - Do not include markdown.
                - Do not include extra fields.
                """),

                new UserChatMessage($"""
                Judge this tech keyword:

                {keyword}
                """)
            };

            var response = await _chatClient.CompleteChatAsync(messages);

            var explanationText = response.Value.Content[0].Text;
            Console.WriteLine("Raw explanationText:");
            Console.WriteLine(explanationText);
            var result = JsonSerializer.Deserialize<TechKeywordExplainResult>(
                explanationText,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                }
            );

            return Ok(new
            {
                analysis = result
            });
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

public class TechKeywordExplainRequest
{
    public string Keyword { get; set; } = "";
}

public class TechKeywordExplainResult
{
    public string Keyword { get; set; } = "";
    public string Explanation { get; set; } = "";
}

public class JobAnalysisResult
{
    public List<string>? requiredSkills { get; set; } = new();

    public int? yearOfExperience { get; set; }

    public string jobLevel { get; set; } = "";

    public List<string>? jobLevelEvidence { get; set; } = new();
}

public class JobDescriptionRequest
{
    public string JobDescription { get; set; } = "";
}