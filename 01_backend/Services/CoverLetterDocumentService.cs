using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using System.Text.RegularExpressions;

namespace StackTrends.Services;

public interface ICoverLetterDocumentService
{
    byte[] CreateDocx(string coverLetter);
}

public sealed class CoverLetterDocumentService : ICoverLetterDocumentService
{
    public byte[] CreateDocx(string coverLetter)
    {
        using var stream = new MemoryStream();

        using (var document = WordprocessingDocument.Create(
            stream,
            WordprocessingDocumentType.Document,
            true))
        {
            var mainPart = document.AddMainDocumentPart();
            var body = new Body();

            var paragraphs = Regex.Split(coverLetter.Trim(), @"\r?\n\s*\r?\n")
                .Where(paragraph => !string.IsNullOrWhiteSpace(paragraph));

            foreach (var paragraphText in paragraphs)
            {
                body.Append(CreateParagraph(paragraphText));
            }

            body.Append(new SectionProperties(
                new PageMargin
                {
                    Top = 1440,
                    Right = 1440,
                    Bottom = 1440,
                    Left = 1440,
                    Header = 720,
                    Footer = 720,
                    Gutter = 0
                }
            ));

            mainPart.Document = new Document(body);
            mainPart.Document.Save();
        }

        return stream.ToArray();
    }

    private static Paragraph CreateParagraph(string paragraphText)
    {
        var paragraph = new Paragraph(new ParagraphProperties(
            new Justification { Val = JustificationValues.Left },
            new SpacingBetweenLines { After = "200", Line = "300" }
        ));
        var lines = paragraphText.Trim()
            .Split('\n', StringSplitOptions.TrimEntries);

        for (var index = 0; index < lines.Length; index++)
        {
            var run = new Run(
                new RunProperties(
                    new RunFonts
                    {
                        Ascii = "Aptos",
                        HighAnsi = "Aptos",
                        EastAsia = "Aptos",
                        ComplexScript = "Aptos"
                    },
                    new FontSize { Val = "22" },
                    new FontSizeComplexScript { Val = "22" }
                ),
                new Text(lines[index]) { Space = SpaceProcessingModeValues.Preserve }
            );
            paragraph.Append(run);

            if (index < lines.Length - 1)
                paragraph.Append(new Run(new Break()));
        }

        return paragraph;
    }
}
