using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using StackTrends.Services;
using System.Text.RegularExpressions;

namespace StackTrends.Controllers;

[ApiController]
[Authorize]
[Route("api/cover-letter")]
public sealed class CoverLetterController : ControllerBase
{
    private const long MaximumCvBytes = 5 * 1024 * 1024;
    private const long MaximumReferenceCoverLetterBytes = 5 * 1024 * 1024;
    private const int MaximumReferenceCoverLetterCharacters = 20_000;
    private const string ChristchurchLocation = "Christchurch";
    private const string OutsideChristchurchLocation = "Outside Christchurch";
    private const string DocxContentType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    private readonly NpgsqlConnection _connection;
    private readonly ICvTextExtractor _cvTextExtractor;
    private readonly ICoverLetterLlmService _llmService;
    private readonly ICoverLetterDocumentService _documentService;
    private readonly ICoverLetterPromptProvider _promptProvider;

    public CoverLetterController(
        NpgsqlConnection connection,
        ICvTextExtractor cvTextExtractor,
        ICoverLetterLlmService llmService,
        ICoverLetterDocumentService documentService,
        ICoverLetterPromptProvider promptProvider)
    {
        _connection = connection;
        _cvTextExtractor = cvTextExtractor;
        _llmService = llmService;
        _documentService = documentService;
        _promptProvider = promptProvider;
    }

    [HttpGet("jobs")]
    public async Task<IActionResult> GetMatchedJobs(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT job_id, job_title, company_name, location, listed_date
            FROM jobs
            WHERE "isMatch" IS TRUE
            ORDER BY listed_date DESC NULLS LAST, job_id DESC
            """;

        var jobs = new List<CoverLetterJobOption>();
        await _connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, _connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            jobs.Add(new CoverLetterJobOption(
                reader.GetInt32(0),
                reader.IsDBNull(1) ? string.Empty : reader.GetString(1),
                reader.IsDBNull(2) ? string.Empty : reader.GetString(2),
                reader.IsDBNull(3) ? string.Empty : reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetDateTime(4)
            ));
        }

        return Ok(jobs);
    }

    [HttpPost("generate")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaximumCvBytes + MaximumReferenceCoverLetterBytes + 128 * 1024)]
    public async Task<IActionResult> Generate(
        [FromForm] IFormFile? cv,
        [FromForm] IFormFile? referenceCoverLetter,
        [FromForm] int? jobId,
        [FromForm] string? jobTitle,
        [FromForm] string? companyName,
        [FromForm] string? jobLocation,
        [FromForm] string? jobDescription,
        [FromForm] string? extraPrompt,
        CancellationToken cancellationToken)
    {
        if (cv == null || cv.Length == 0)
            return BadRequest(new { error = "A CV file is required." });

        if (cv.Length > MaximumCvBytes)
            return BadRequest(new { error = "The CV file must not exceed 5 MB." });

        var extension = Path.GetExtension(cv.FileName).ToLowerInvariant();
        if (extension != ".docx")
            return BadRequest(new { error = "Only DOCX CV files are supported." });

        if (referenceCoverLetter is { Length: > 0 })
        {
            if (referenceCoverLetter.Length > MaximumReferenceCoverLetterBytes)
            {
                return BadRequest(new
                {
                    error = "The reference cover letter must not exceed 5 MB."
                });
            }

            var referenceExtension = Path.GetExtension(
                referenceCoverLetter.FileName
            ).ToLowerInvariant();
            if (referenceExtension != ".docx")
            {
                return BadRequest(new
                {
                    error = "Only DOCX reference cover letter files are supported."
                });
            }
        }

        jobTitle = jobTitle?.Trim();
        companyName = companyName?.Trim();
        jobLocation = jobLocation?.Trim();
        jobDescription = jobDescription?.Trim();
        var usesMatchedJob = jobId.HasValue;
        var hasAnyManualJobInput = !string.IsNullOrWhiteSpace(jobTitle)
            || !string.IsNullOrWhiteSpace(companyName)
            || !string.IsNullOrWhiteSpace(jobLocation)
            || !string.IsNullOrWhiteSpace(jobDescription);

        if (usesMatchedJob && hasAnyManualJobInput)
        {
            return BadRequest(new
            {
                error = "Choose either a matched job or manually entered job details, not both."
            });
        }

        if (usesMatchedJob && jobId <= 0)
            return BadRequest(new { error = "A valid job ID is required." });

        if (!usesMatchedJob
            && (string.IsNullOrWhiteSpace(jobTitle)
                || string.IsNullOrWhiteSpace(jobLocation)
                || string.IsNullOrWhiteSpace(jobDescription)))
        {
            return BadRequest(new
            {
                error = "Job title, location category, and job description are required for manual job entry."
            });
        }

        if (jobTitle?.Length > 300)
            return BadRequest(new { error = "Job title must not exceed 300 characters." });

        if (companyName?.Length > 300)
            return BadRequest(new { error = "Company name must not exceed 300 characters." });

        if (!usesMatchedJob
            && !jobLocation!.Equals(ChristchurchLocation, StringComparison.OrdinalIgnoreCase)
            && !jobLocation.Equals(OutsideChristchurchLocation, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                error = "Choose either Christchurch or Outside Christchurch for the location category."
            });
        }

        if (jobDescription?.Length > 30_000)
        {
            return BadRequest(new
            {
                error = "Job description must not exceed 30,000 characters."
            });
        }

        extraPrompt = extraPrompt?.Trim();
        if (extraPrompt?.Length > 2_000)
        {
            return BadRequest(new
            {
                error = "Additional instructions must not exceed 2,000 characters."
            });
        }

        CoverLetterJob? job;
        if (usesMatchedJob)
        {
            job = await FindMatchedJobAsync(jobId!.Value, cancellationToken);
            if (job == null)
            {
                return NotFound(new
                {
                    error = "The selected job was not found or isMatch is not true."
                });
            }
        }
        else
        {
            var normalizedLocation = jobLocation!.Equals(
                ChristchurchLocation,
                StringComparison.OrdinalIgnoreCase)
                ? ChristchurchLocation
                : OutsideChristchurchLocation;
            job = new CoverLetterJob(
                jobTitle!,
                companyName ?? string.Empty,
                normalizedLocation,
                jobDescription!
            );
        }

        try
        {
            var cvText = await _cvTextExtractor.ExtractAsync(cv, cancellationToken);
            string? referenceCoverLetterText = null;
            if (referenceCoverLetter is { Length: > 0 })
            {
                referenceCoverLetterText = await _cvTextExtractor.ExtractAsync(
                    referenceCoverLetter,
                    "reference cover letter",
                    MaximumReferenceCoverLetterCharacters,
                    cancellationToken
                );
            }

            var coverLetter = await _llmService.GenerateAsync(
                cvText,
                job.JobTitle,
                job.CompanyName,
                job.JobLocation,
                job.JobDescription,
                referenceCoverLetterText,
                extraPrompt,
                cancellationToken
            );
            var documentBytes = _documentService.CreateDocx(coverLetter);
            var fileName = BuildFileName(job.JobTitle, job.CompanyName);

            return Ok(new
            {
                coverLetter,
                fileName,
                contentType = DocxContentType,
                documentBase64 = Convert.ToBase64String(documentBytes),
                allowedProjectLinks = _promptProvider.AllowedProjectLinks
            });
        }
        catch (InvalidDataException error)
        {
            return BadRequest(new { error = error.Message });
        }
        catch (InvalidOperationException error)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new
            {
                error = error.Message
            });
        }
    }

    private async Task<CoverLetterJob?> FindMatchedJobAsync(
        int jobId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT job_title, company_name, location, job_des
            FROM jobs
            WHERE job_id = @jobId
              AND "isMatch" IS TRUE
              AND job_des IS NOT NULL
              AND BTRIM(job_des) <> ''
            """;

        if (_connection.State != System.Data.ConnectionState.Open)
            await _connection.OpenAsync(cancellationToken);

        await using var command = new NpgsqlCommand(sql, _connection);
        command.Parameters.AddWithValue("jobId", jobId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        if (!await reader.ReadAsync(cancellationToken)) return null;

        return new CoverLetterJob(
            reader.IsDBNull(0) ? string.Empty : reader.GetString(0),
            reader.IsDBNull(1) ? string.Empty : reader.GetString(1),
            reader.IsDBNull(2) ? string.Empty : reader.GetString(2),
            reader.GetString(3)
        );
    }

    private static string BuildFileName(string jobTitle, string companyName)
    {
        var rawName = string.IsNullOrWhiteSpace(companyName)
            ? $"{jobTitle}_Cover Letter"
            : $"{jobTitle}_{companyName}";
        var invalidCharacters = new HashSet<char>(
            Path.GetInvalidFileNameChars().Concat("<>:\"/\\|?*")
        );
        var safeName = new string(rawName
            .Select(character => invalidCharacters.Contains(character) ? '_' : character)
            .ToArray());
        safeName = Regex.Replace(safeName, @"\s+", " ").Trim(' ', '.', '_');

        return $"{(string.IsNullOrWhiteSpace(safeName) ? "Cover Letter" : safeName)}.docx";
    }

    private sealed record CoverLetterJob(
        string JobTitle,
        string CompanyName,
        string JobLocation,
        string JobDescription);

    public sealed record CoverLetterJobOption(
        int JobId,
        string JobTitle,
        string CompanyName,
        string Location,
        DateTime? ListedDate);
}
