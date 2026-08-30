using OpenAI.Chat;
using System.Text.RegularExpressions;

namespace StackTrends.Services;

public interface ICoverLetterLlmService
{
    Task<string> GenerateAsync(
        string cvText,
        string jobTitle,
        string companyName,
        string jobLocation,
        string jobDescription,
        string? referenceCoverLetter,
        string? additionalInstructions,
        CancellationToken cancellationToken);
}

public sealed class CoverLetterLlmService : ICoverLetterLlmService
{
    private readonly ChatClient _chatClient;
    private readonly ICoverLetterPromptProvider _promptProvider;
    private readonly ILogger<CoverLetterLlmService> _logger;

    public CoverLetterLlmService(
        ChatClient chatClient,
        ICoverLetterPromptProvider promptProvider,
        ILogger<CoverLetterLlmService> logger)
    {
        _chatClient = chatClient;
        _promptProvider = promptProvider;
        _logger = logger;
    }

    public async Task<string> GenerateAsync(
        string cvText,
        string jobTitle,
        string companyName,
        string jobLocation,
        string jobDescription,
        string? referenceCoverLetter,
        string? additionalInstructions,
        CancellationToken cancellationToken)
    {
        string? previousDraft = null;
        IReadOnlyList<string> previousValidationErrors = Array.Empty<string>();
        var validationOverrides = DetectValidationOverrides(additionalInstructions);

        for (var attempt = 1; attempt <= 3; attempt++)
        {
            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(_promptProvider.SystemPrompt),
                new UserChatMessage($"""
                Write the cover letter for this application.

                Job title:
                {jobTitle}

                Company:
                {(string.IsNullOrWhiteSpace(companyName) ? "Not provided." : companyName)}

                Job location:
                {(string.IsNullOrWhiteSpace(jobLocation) ? "Not separately provided; use the job description if explicit." : jobLocation)}

                Job description:
                {jobDescription}

                Junwen's CV:
                {cvText}

                Junwen's previous cover letter for reusable content and style reference:
                {(string.IsNullOrWhiteSpace(referenceCoverLetter) ? "None provided." : referenceCoverLetter.Trim())}

                Additional instructions for this specific application:
                {(string.IsNullOrWhiteSpace(additionalInstructions) ? "None." : additionalInstructions.Trim())}
                """)
            };

            if (previousDraft != null)
            {
                var validationFeedback = string.Join(
                    Environment.NewLine,
                    previousValidationErrors.Select(error => $"- {error}")
                );
                messages.Add(new UserChatMessage($"""
                    The previous draft did not satisfy these applicable format rules:
                    {validationFeedback}

                    Rewrite it to fix these specific issues without dropping the Additional
                    Instructions. Only treat a default format rule as changed when the
                    Additional Instructions clearly change that specific rule.

                    Previous draft:
                    {previousDraft}
                    """));
            }

            var response = await _chatClient.CompleteChatAsync(
                messages,
                cancellationToken: cancellationToken
            );
            var draft = response.Value.Content[0].Text.Trim();

            var validation = ValidateDraft(draft, validationOverrides);
            if (validation.IsValid) return draft;

            _logger.LogWarning(
                "Cover-letter draft attempt {Attempt} failed validation: {ValidationErrors}",
                attempt,
                string.Join(" | ", validation.Errors)
            );
            previousDraft = draft;
            previousValidationErrors = validation.Errors;
        }

        throw new InvalidOperationException(
            $"The AI could not produce a cover letter that satisfies the applicable writing rules. Last validation issues: {string.Join("; ", previousValidationErrors)}"
        );
    }

    private static DraftValidationResult ValidateDraft(
        string draft,
        ValidationOverrides overrides)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(draft))
        {
            errors.Add("The response was empty.");
            return new DraftValidationResult(false, errors);
        }

        var sections = Regex.Split(draft.Trim(), @"\r?\n\s*\r?\n")
            .Select(section => section.Trim())
            .Where(section => !string.IsNullOrWhiteSpace(section))
            .ToArray();

        if (sections.Length == 0)
        {
            errors.Add("The response did not contain any readable sections.");
            return new DraftValidationResult(false, errors);
        }

        // Greeting + opening + 1-3 project paragraphs + ending + sign-off.
        if (!overrides.Structure && sections.Length is < 5 or > 7)
        {
            errors.Add(
                $"Use 5 to 7 blank-line-separated sections: greeting, opening, 1 to 3 project paragraphs, ending, and sign-off. The draft had {sections.Length}."
            );
        }
        if (!overrides.Greeting
            && !sections[0].Equals("Dear Hiring Team,", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("Use the exact greeting 'Dear Hiring Team,'.");
        }

        if (!overrides.SignOff)
        {
            var signOffLines = sections[^1]
                .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (signOffLines.Length != 2
                || !signOffLines[0].Equals("Kind regards,", StringComparison.OrdinalIgnoreCase)
                || !signOffLines[1].Equals("Junwen", StringComparison.OrdinalIgnoreCase))
            {
                errors.Add("Use the exact two-line sign-off 'Kind regards,' followed by 'Junwen'.");
            }
        }

        var bodyStartIndex = overrides.OmitGreeting ? 0 : 1;
        var bodyEndIndex = overrides.OmitSignOff ? sections.Length : sections.Length - 1;
        if (bodyEndIndex <= bodyStartIndex)
        {
            errors.Add("The draft did not contain a readable cover-letter body.");
            return new DraftValidationResult(false, errors);
        }

        var bodyParagraphs = sections[bodyStartIndex..bodyEndIndex];
        if (!overrides.Structure && bodyParagraphs.Length is < 3 or > 5)
        {
            errors.Add(
                $"Use 3 to 5 body paragraphs: one opening, 1 to 3 project paragraphs, and one ending. The draft had {bodyParagraphs.Length}."
            );
        }

        var projectWordCount = bodyParagraphs.Length >= 3
            ? bodyParagraphs[1..^1].Sum(CountWords)
            : 0;
        var bodyWordCount = bodyParagraphs.Sum(CountWords);
        if (!overrides.Length && bodyWordCount is < 200 or > 350)
        {
            errors.Add(
                $"Keep the body between 200 and 350 words. The draft had {bodyWordCount} words."
            );
        }

        if (!overrides.ProjectProportion
            && bodyParagraphs.Length >= 3
            && bodyWordCount > 0)
        {
            var projectProportion = (double)projectWordCount / bodyWordCount;
            if (projectProportion < 0.50)
            {
                errors.Add(
                    $"Make the project-experience paragraphs at least 50% of the body. They were {projectProportion:P0} ({projectWordCount} of {bodyWordCount} words)."
                );
            }
        }

        return new DraftValidationResult(errors.Count == 0, errors);
    }

    private static ValidationOverrides DetectValidationOverrides(
        string? additionalInstructions)
    {
        if (string.IsNullOrWhiteSpace(additionalInstructions))
            return new ValidationOverrides();

        var text = additionalInstructions.Trim();
        var omitGreeting = MatchesAny(text,
            @"\b(?:omit|remove|without|no)\b.{0,20}\b(?:greeting|salutation)\b",
            @"(?:不要|省略|不需要).{0,20}(?:称呼|开头称谓)");
        var omitSignOff = MatchesAny(text,
            @"\b(?:omit|remove|without|no)\b.{0,20}\b(?:sign[\s-]?off|closing salutation)\b",
            @"(?:不要|省略|不需要).{0,20}(?:落款|署名|结尾称谓)");
        var greeting = omitGreeting || MatchesAny(text,
            @"\b(?:address|begin|start|open|use|change|replace|omit|remove|without)\b.{0,40}\b(?:greeting|salutation|dear)\b",
            @"\baddress\b.{0,40}\b(?:letter|it)\b",
            @"\b(?:greeting|salutation)\b.{0,40}\b(?:should|must|use|change|replace|omit|remove|instead)\b",
            @"(?:称呼|开头称谓).{0,20}(?:改|用|省略|不要|不需要)");
        var signOff = omitSignOff || MatchesAny(text,
            @"\b(?:sign[\s-]?off|closing salutation)\b",
            @"\b(?:end|close)\b.{0,40}\b(?:with|using)\b",
            @"\b(?:use|end|close)\b.{0,40}\b(?:kind regards|best regards|yours sincerely|sincerely)\b",
            @"(?:落款|署名|结尾称谓).{0,20}(?:改|用|省略|不要|不需要)");
        var structure = omitGreeting || omitSignOff || MatchesAny(text,
            @"\b(?:use|write|make|change|format|organise|organize|limit|keep)\b.{0,40}\b(?:structure|format|paragraphs?|sections?)\b",
            @"\b(?:structure|format|paragraphs?|sections?)\b.{0,40}\b(?:should|must|use|change|instead|only)\b",
            @"(?:结构|格式|段落).{0,20}(?:改|用|写成|限制|只要|调整)",
            @"(?:omit|remove|without|no)\b.{0,20}\b(?:greeting|salutation|sign[\s-]?off)\b",
            @"(?:不要|省略|不需要).{0,20}(?:称呼|落款|署名)");
        var length = MatchesAny(text,
            @"\b(?:word count|\d+\s*(?:-|to)?\s*words?|under\s+\d+\s+words?|over\s+\d+\s+words?)\b",
            @"\b(?:shorter|longer|length)\b",
            @"(?:字数|长度|更短|更长)");
        var projectProportion = MatchesAny(text,
            @"\bproject(?:s| experience| section| paragraphs?| content)?\b.{0,50}\b(?:percent|percentage|proportion|share|half|majority|brief|shorter|less|fewer)\b",
            @"\b(?:less|fewer|brief|shorter)\b.{0,40}\bproject(?:s| experience| section| paragraphs?| content)?\b",
            @"\b(?:instead of|rather than|over)\b.{0,30}\bproject(?:s| experience)?\b",
            @"(?:项目经历|项目部分|项目段落).{0,30}(?:比例|占比|少写|缩短|简短|不到一半)");

        return new ValidationOverrides(
            greeting,
            signOff,
            structure,
            length,
            projectProportion,
            omitGreeting,
            omitSignOff
        );
    }

    private static bool MatchesAny(string text, params string[] patterns)
    {
        return patterns.Any(pattern => Regex.IsMatch(
            text,
            pattern,
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant
        ));
    }

    private static int CountWords(string text)
    {
        var textWithoutLinkDestinations = Regex.Replace(
            text,
            @"\[(?<label>[^\]\r\n]+)\]\(https://[^)\s]+\)",
            "${label}"
        );

        return Regex.Matches(
            textWithoutLinkDestinations,
            @"\b[\p{L}\p{N}][\p{L}\p{N}’'\-]*\b"
        ).Count;
    }

    private readonly record struct ValidationOverrides(
        bool Greeting = false,
        bool SignOff = false,
        bool Structure = false,
        bool Length = false,
        bool ProjectProportion = false,
        bool OmitGreeting = false,
        bool OmitSignOff = false
    );

    private sealed record DraftValidationResult(
        bool IsValid,
        IReadOnlyList<string> Errors
    );
}
