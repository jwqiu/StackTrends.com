using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

namespace StackTrends.Services;

public interface ICvTextExtractor
{
    Task<string> ExtractAsync(IFormFile file, CancellationToken cancellationToken);
}

public sealed class CvTextExtractor : ICvTextExtractor
{
    private const int MaximumExtractedCharacters = 40_000;

    public async Task<string> ExtractAsync(
        IFormFile file,
        CancellationToken cancellationToken)
    {
        await using var input = file.OpenReadStream();
        using var buffer = new MemoryStream();
        await input.CopyToAsync(buffer, cancellationToken);
        buffer.Position = 0;

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (extension != ".docx")
        {
            throw new InvalidDataException("Only DOCX CV files are supported.");
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
                "The CV file could not be read. Please upload a valid DOCX file.",
                error
            );
        }

        text = NormalizeWhitespace(text);
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new InvalidDataException("No readable text was found in the DOCX CV.");
        }

        if (text.Length > MaximumExtractedCharacters)
        {
            throw new InvalidDataException("The extracted CV text is too long.");
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
