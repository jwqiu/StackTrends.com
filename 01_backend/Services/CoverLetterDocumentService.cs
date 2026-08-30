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
    private static readonly Regex MarkdownLinkRegex = new(
        @"\[(?<label>[^\]\r\n]+)\]\((?<url>https://[^)\s]+)\)",
        RegexOptions.Compiled
    );

    private readonly IReadOnlySet<string> _allowedProjectLinks;

    public CoverLetterDocumentService(ICoverLetterPromptProvider promptProvider)
    {
        _allowedProjectLinks = promptProvider.AllowedProjectLinks;
    }

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
                body.Append(CreateParagraph(mainPart, paragraphText));
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

    private Paragraph CreateParagraph(
        MainDocumentPart mainPart,
        string paragraphText)
    {
        var paragraph = new Paragraph(new ParagraphProperties(
            new Justification { Val = JustificationValues.Left },
            new SpacingBetweenLines { After = "200", Line = "300" }
        ));
        var lines = paragraphText.Trim()
            .Split('\n', StringSplitOptions.TrimEntries);

        for (var index = 0; index < lines.Length; index++)
        {
            AppendInlineContent(paragraph, mainPart, lines[index]);

            if (index < lines.Length - 1)
                paragraph.Append(new Run(new Break()));
        }

        return paragraph;
    }

    private void AppendInlineContent(
        Paragraph paragraph,
        MainDocumentPart mainPart,
        string text)
    {
        var currentIndex = 0;

        foreach (Match match in MarkdownLinkRegex.Matches(text))
        {
            var url = match.Groups["url"].Value;
            if (!_allowedProjectLinks.Contains(url)) continue;

            if (match.Index > currentIndex)
                paragraph.Append(CreateTextRun(text[currentIndex..match.Index]));

            var relationship = mainPart.AddHyperlinkRelationship(new Uri(url), true);
            paragraph.Append(new Hyperlink(
                new Run(
                    CreateRunProperties(isHyperlink: true),
                    new Text(match.Groups["label"].Value)
                    {
                        Space = SpaceProcessingModeValues.Preserve
                    }
                ))
            {
                Id = relationship.Id,
                History = OnOffValue.FromBoolean(true)
            });

            currentIndex = match.Index + match.Length;
        }

        if (currentIndex < text.Length)
            paragraph.Append(CreateTextRun(text[currentIndex..]));
    }

    private static Run CreateTextRun(string text)
    {
        return new Run(
            CreateRunProperties(isHyperlink: false),
            new Text(text) { Space = SpaceProcessingModeValues.Preserve }
        );
    }

    private static RunProperties CreateRunProperties(bool isHyperlink)
    {
        var properties = new RunProperties(
            new RunFonts
            {
                Ascii = "Aptos",
                HighAnsi = "Aptos",
                EastAsia = "Aptos",
                ComplexScript = "Aptos"
            }
        );

        if (isHyperlink)
        {
            properties.Append(
                new Color { Val = "467886" },
                new Underline { Val = UnderlineValues.Single }
            );
        }

        properties.Append(
            new FontSize { Val = "22" },
            new FontSizeComplexScript { Val = "22" }
        );

        return properties;
    }
}
