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

                Extract exactly four fields:
                {
                "requiredSkills": [],
                "yearOfExperience": -1,
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
                Extract the candidate's explicitly stated experience-duration requirement.
                Return only an integer: -1, 0, or a positive integer.

                Priority rules:
                - First, look for an overall/general professional experience requirement.
                - If an overall experience requirement exists, use that value.
                - If no overall experience requirement exists, use the experience requirement for the core skill of the role.
                - If it is not possible to determine which skill is the core skill, use the highest explicitly stated experience duration.
                - If an experience duration is stated as a range, return the lowest value in that range.
                - If the JD mentions months of experience and it is less than 12 months, return 0.
                - If the JD does not mention any clear, specific experience duration, return -1.
                - Do not infer an experience duration from seniority terms such as "Senior" or "Lead", or from responsibilities, salary, job level, or general role complexity.
                - Only return a duration when the JD explicitly states that it is a requirement for the candidate's professional, commercial, technical, or role-relevant work experience.
                - Do not treat any of the following as an experience requirement:
                  - security-clearance or background-check history
                  - residency, citizenship, immigration, or work-eligibility duration
                  - project, transformation, migration, or implementation duration
                  - contract or fixed-term duration
                  - company age or years in business
                  - product, platform, or technology age
                  - tenure, benefits, annual leave, or employment milestones
                  - notice periods, working hours, office days, or scheduling information
                - Apply the priority, highest-duration, and range rules only after excluding all durations that are not candidate work-experience requirements.
                - Never select a duration merely because it is the largest duration mentioned in the JD.

                Examples:
                - "2+ years of professional experience" => 2
                - "At least 3 years of software development experience" => 3
                - "3-5 years of relevant experience" => 3
                - "6 months of commercial experience" => 0
                - "Some experience with Python" => -1
                - "Experience with React is preferred" => -1
                - "Approximately 10 years of background history must be verifiable for security clearance" => -1
                - "You must have lived in New Zealand for the past 5 years" => -1
                - "This is a 12-month fixed-term contract" => -1
                - "Over the next 18 months, you will help deliver the migration" => -1
                - "The company has operated for more than 20 years" => -1
                - "5 weeks of annual leave after 2 years of tenure" => -1
                - "3+ years of Azure engineering experience and 10 years of verifiable background history for security clearance" => 3

                If no specific experience duration is explicitly stated, return -1.

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

            if (analysisResult != null && !analysisResult.yearOfExperience.HasValue)
            {
                analysisResult.yearOfExperience = -1;
            }

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

    [HttpPost("analyze-job-fit")]
    public async Task<IActionResult> AnalyzeJobFit([FromBody] JobFitAnalysisRequest request)
    {
        if (request == null
            || string.IsNullOrWhiteSpace(request.JobTitle)
            || string.IsNullOrWhiteSpace(request.JobDescription))
        {
            return BadRequest(new
            {
                error = "Job title and job description are required."
            });
        }

        try
        {
            var messages = new List<ChatMessage>
            {
                new SystemChatMessage("""
                You assess whether a New Zealand junior-level job aligns with the target
                career directions of a recent master's graduate.

                The candidate is looking for a role in AT LEAST ONE of these directions:

                1. Computer Vision
                   Roles whose core work involves images or video, such as image
                   recognition, object detection, segmentation, visual inspection,
                   image processing, video analytics, or deploying vision models.

                2. AI Automation
                   Roles whose core work involves building AI-powered automation, such
                   as LLM applications, AI agents, RAG systems, intelligent workflows,
                   generative-AI integrations, or automating business processes with AI.
                   Ordinary test automation, DevOps automation, scripting, RPA, or
                   workflow automation without a meaningful AI component does not count.

                3. Machine Learning
                   Roles whose core work involves developing, training, evaluating,
                   deploying, monitoring, or materially applying machine-learning or
                   deep-learning models. Data analysis or conventional software
                   engineering without meaningful model work does not count.

                Decision rules:
                - Use OR logic. A role is a match when at least one direction is a
                  substantial part of the role's responsibilities or intended outcome.
                - Judge the actual role, not the employer's general industry or products.
                - A passing reference to AI, ML, Copilot, automation, data, or an AI
                  product is not enough.
                - Do not assume missing responsibilities and do not invent evidence.
                - Because the input has already been classified as Junior, focus on
                  career-direction alignment rather than reclassifying seniority.
                - matchedDirections may contain only: "Computer Vision",
                  "AI Automation", and "Machine Learning".
                - If isMatch is true, matchedDirections must contain at least one item.
                - If isMatch is false, matchedDirections must be empty.
                - reason must be one concise sentence explaining the strongest evidence
                  for the decision from the title or description.
                """),
                new UserChatMessage($"""
                Assess this role for the candidate.

                Job title:
                {request.JobTitle}

                Job description:
                {request.JobDescription}
                """)
            };

            ChatCompletionOptions options = new()
            {
                ResponseFormat = ChatResponseFormat.CreateJsonSchemaFormat(
                    jsonSchemaFormatName: "job_fit_analysis",
                    jsonSchema: BinaryData.FromBytes("""
                        {
                            "type": "object",
                            "properties": {
                                "isMatch": { "type": "boolean" },
                                "matchedDirections": {
                                    "type": "array",
                                    "items": {
                                        "type": "string",
                                        "enum": [
                                            "Computer Vision",
                                            "AI Automation",
                                            "Machine Learning"
                                        ]
                                    }
                                },
                                "reason": { "type": "string" }
                            },
                            "required": ["isMatch", "matchedDirections", "reason"],
                            "additionalProperties": false
                        }
                        """u8.ToArray()),
                    jsonSchemaIsStrict: true)
            };

            var response = await _chatClient.CompleteChatAsync(messages, options);
            var analysisText = response.Value.Content[0].Text;
            var analysisResult = JsonSerializer.Deserialize<JobFitAnalysisResult>(
                analysisText,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                }
            );

            if (analysisResult == null)
            {
                throw new InvalidOperationException("The LLM returned an empty job-fit result.");
            }

            if (analysisResult.isMatch && analysisResult.matchedDirections.Count == 0)
            {
                throw new InvalidOperationException(
                    "A matching role must include at least one matched direction."
                );
            }

            if (!analysisResult.isMatch && analysisResult.matchedDirections.Count != 0)
            {
                throw new InvalidOperationException(
                    "A non-matching role cannot include matched directions."
                );
            }

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

public class JobFitAnalysisRequest
{
    public string JobTitle { get; set; } = "";

    public string JobDescription { get; set; } = "";
}

public class JobFitAnalysisResult
{
    public bool isMatch { get; set; }

    public List<string> matchedDirections { get; set; } = new();

    public string reason { get; set; } = "";
}
