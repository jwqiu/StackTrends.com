using System.Text;
using System.Text.Json;

namespace StackTrends.Services;

public interface ICoverLetterPromptProvider
{
    string SystemPrompt { get; }
    IReadOnlySet<string> AllowedProjectLinks { get; }
}

public sealed class CoverLetterPromptProvider : ICoverLetterPromptProvider
{
    private const string CandidateContextPlaceholder = "{{CANDIDATE_CONTEXT}}";
    private const string ProjectResourcesPlaceholder = "{{PROJECT_RESOURCES}}";

    public CoverLetterPromptProvider(IHostEnvironment environment)
    {
        var promptDirectory = Path.Combine(
            environment.ContentRootPath,
            "Prompts",
            "CoverLetter"
        );
        var candidateContext = ReadRequiredFile(
            Path.Combine(promptDirectory, "candidate-context.md")
        );
        var writingRules = ReadRequiredFile(
            Path.Combine(promptDirectory, "writing-rules.md")
        );
        var projectCatalogJson = ReadRequiredFile(
            Path.Combine(promptDirectory, "projects.json")
        );
        var projectCatalog = JsonSerializer.Deserialize<ProjectCatalog>(
            projectCatalogJson,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
        ) ?? throw new InvalidDataException("The cover-letter project catalog is invalid.");

        ValidateProjectCatalog(projectCatalog);

        var projectResources = BuildProjectResources(projectCatalog.Projects);
        SystemPrompt = writingRules
            .Replace(CandidateContextPlaceholder, candidateContext, StringComparison.Ordinal)
            .Replace(ProjectResourcesPlaceholder, projectResources, StringComparison.Ordinal);

        if (SystemPrompt.Contains("{{", StringComparison.Ordinal))
            throw new InvalidDataException("The cover-letter writing rules contain an unresolved placeholder.");

        AllowedProjectLinks = projectCatalog.Projects
            .SelectMany(project => new[] { project.LiveSite, project.GitHub })
            .ToHashSet(StringComparer.Ordinal);
    }

    public string SystemPrompt { get; }

    public IReadOnlySet<string> AllowedProjectLinks { get; }

    private static string ReadRequiredFile(string path)
    {
        if (!File.Exists(path))
            throw new FileNotFoundException("A required cover-letter configuration file was not found.", path);

        var content = File.ReadAllText(path).Trim();
        if (string.IsNullOrWhiteSpace(content))
            throw new InvalidDataException($"The cover-letter configuration file is empty: {path}");

        return content;
    }

    private static void ValidateProjectCatalog(ProjectCatalog catalog)
    {
        if (catalog.Projects.Count == 0)
            throw new InvalidDataException("The cover-letter project catalog must contain at least one project.");

        foreach (var project in catalog.Projects)
        {
            if (string.IsNullOrWhiteSpace(project.Id)
                || string.IsNullOrWhiteSpace(project.Name)
                || string.IsNullOrWhiteSpace(project.LiveSite)
                || string.IsNullOrWhiteSpace(project.GitHub)
                || project.Directions == null
                || project.VerifiedFacts == null)
            {
                throw new InvalidDataException("Every cover-letter project requires an id, name, live site, GitHub URL, directions, and verified facts.");
            }

            if (project.VerifiedFacts.Any(string.IsNullOrWhiteSpace))
                throw new InvalidDataException($"Project '{project.Name}' contains an empty verified fact.");

            ValidateHttpsUrl(project.LiveSite, project.Name, "live site");
            ValidateHttpsUrl(project.GitHub, project.Name, "GitHub");
        }
    }

    private static void ValidateHttpsUrl(string value, string projectName, string linkName)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || uri.Scheme != Uri.UriSchemeHttps)
        {
            throw new InvalidDataException(
                $"The {linkName} URL for project '{projectName}' must be an absolute HTTPS URL."
            );
        }
    }

    private static string BuildProjectResources(IEnumerable<ProjectDefinition> projects)
    {
        var output = new StringBuilder();

        foreach (var project in projects)
        {
            if (output.Length > 0) output.AppendLine();

            output.AppendLine($"- {project.Name}");
            if (project.Directions.Count > 0)
                output.AppendLine($"  - Relevant directions: {string.Join(", ", project.Directions)}");
            if (!string.IsNullOrWhiteSpace(project.Positioning))
                output.AppendLine($"  - Positioning: {project.Positioning}");
            if (project.VerifiedFacts.Count > 0)
            {
                output.AppendLine("  - Verified facts:");
                foreach (var fact in project.VerifiedFacts)
                    output.AppendLine($"    - {fact}");
            }
            output.AppendLine(
                $"  - Exact link format: {project.Name} [ [Live Site]({project.LiveSite}) | [GitHub]({project.GitHub}) ]"
            );
        }

        return output.ToString().TrimEnd();
    }

    private sealed record ProjectCatalog(List<ProjectDefinition> Projects);

    private sealed record ProjectDefinition(
        string Id,
        string Name,
        string LiveSite,
        string GitHub,
        List<string> Directions,
        string Positioning,
        List<string> VerifiedFacts
    );
}
