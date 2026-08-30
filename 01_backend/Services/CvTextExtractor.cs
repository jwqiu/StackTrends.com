using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

namespace StackTrends.Services;

public interface ICvTextExtractor
{
    Task<string> ExtractAsync(IFormFile file, CancellationToken cancellationToken);
    Task<string> ExtractAsync(
        IFormFile file,
        string documentName,
        int maximumExtractedCharacters,
        CancellationToken cancellationToken);
}

public sealed class CvTextExtractor : ICvTextExtractor
{
    private const int MaximumExtractedCharacters = 40_000;

    public async Task<string> ExtractAsync(
        IFormFile file,
        CancellationToken cancellationToken)
    {
        return await ExtractAsync(
            file,
            "CV",
            MaximumExtractedCharacters,
            cancellationToken
        );
    }

    public async Task<string> ExtractAsync(
        IFormFile file,
        string documentName,
        int maximumExtractedCharacters,
        CancellationToken cancellationToken)
    {
        await using var input = file.OpenReadStream();
        using var buffer = new MemoryStream();
        await input.CopyToAsync(buffer, cancellationToken);
        buffer.Position = 0;

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (extension != ".docx")
        {
            throw new InvalidDataException($"Only DOCX {documentName} files are supported.");
        }

        string text;
        try
        {
            text = ExtractDocx(buffer);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (InvalidDataException)
        {
            throw;
        }
        catch (Exception error)
        {
            throw new InvalidDataException(
                $"The {documentName} file could not be read. Please upload a valid DOCX file.",
                error
            );
        }

        text = NormalizeWhitespace(text);
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new InvalidDataException(
                $"No readable text was found in the DOCX {documentName}."
            );
        }

        if (text.Length > maximumExtractedCharacters)
        {
            throw new InvalidDataException($"The extracted {documentName} text is too long.");
        }

        return text;
    }

    private static string ExtractDocx(Stream stream)
    {
        using var document = WordprocessingDocument.Open(stream, false);
        var body = document.MainDocumentPart?.Document?.Body;
        if (body == null) return string.Empty;

        return string.Join(
            Environment.NewLine,
            body.Descendants<Paragraph>()
                .Select(paragraph => string.Concat(
                    paragraph.Descendants<Text>().Select(text => text.Text)
                ))
                .Where(text => !string.IsNullOrWhiteSpace(text))
        );
    }

    private static string NormalizeWhitespace(string text)
    {
        return string.Join(
            Environment.NewLine,
            text.Replace("\0", string.Empty)
                .Split('\n')
                .Select(line => string.Join(' ', line.Split(
                    (char[]?)null,
                    StringSplitOptions.RemoveEmptyEntries
                )))
                .Where(line => !string.IsNullOrWhiteSpace(line))
        ).Trim();
    }
}
