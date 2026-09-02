# StackRadar

**A personal AI-powered job search system that turns real-world job-market data into actionable career insights, identifies relevant opportunities, and generates tailored cover letters.**

StackRadar was built around an end-to-end job-search workflow for early-career AI and software roles in New Zealand. It collects and enriches job postings, reveals which technologies employers are looking for, and automatically screens newly listed roles to identify opportunities that align with predefined career directions and are worth reviewing manually. For selected roles, it then generates tailored cover letters grounded in an uploaded CV and verified candidate and project context.

**[Try StackRadar Live →](https://www.stackradar.me)**

> **Image placeholder:** Add an overview image or short GIF showing the complete journey from Tech Trends to matched jobs and cover-letter generation.

## Why I Built It

Early-career technology job seekers face three connected challenges:

1. **Understanding the market** — There is often a gap between the technical skills taught at university and those employers are actually looking for. Without clear evidence of current job-market demand, students may struggle to understand employer expectations and decide which skills to learn next.
2. **Finding relevant opportunities** — For many job seekers, a typical day involves checking multiple job platforms for new roles and assessing the suitability of each one. This is a highly repetitive and time-consuming process, especially when technical, experience, and seniority requirements are buried in full job descriptions.
3. **Preparing a tailored application** — Writing a tailored cover letter for every application is another repetitive and time-consuming task. Job seekers must repeatedly analyse each job description, identify their most relevant experience, and adapt their core story to the role.

StackRadar brings these stages together in one connected system: understand demand, identify worthwhile opportunities, and prepare a tailored application.

## AI-Powered Job Search Automation Workflow

```text
Automatically collect new job postings
        ↓
Clean and normalise raw job data
        ↓
Extract skills, experience requirements, and seniority signals through structured LLM analysis
        ↓
Aggregate job data into technology-demand insights
        ↓
Evaluate new Junior roles against predefined career directions
        ↓
Flag aligned roles for manual follow-up
        ↓
Match the selected role's requirements with relevant CV and project evidence
        ↓
Generate and validate a tailored cover letter
        ↓
Preview and download the application-ready DOCX
```

The workflow automates repetitive data collection, job analysis, opportunity screening, and first-draft preparation while keeping the final decision to pursue a role with the job seeker.

> **Image placeholder:** Add a workflow diagram that distinguishes automated AI processing from the manual review step. Suggested file: `docs/ai_job_search_workflow.png`.

## Core Features

### 1. Technology Market Intelligence

StackRadar identifies and normalises technical skills mentioned across more than 6,000 real-world job postings. It analyses how frequently each technology appears and presents demand across job levels, companies, technology categories, and time periods.

This helps users:

- understand which technologies employers are actively requesting;
- compare demand across Junior, Intermediate, and Senior roles;
- explore the technology profiles of different companies;
- identify growing and declining technologies; and
- make better-informed learning and career-development decisions.

![StackRadar Technology Demand Insights](./docs/skillstrend.jpg)

### 2. Automated Job Screening

An LLM analyses job descriptions to identify key requirements and assess whether newly collected Junior roles align with predefined career directions—Computer Vision, Machine Learning, and AI Automation. Relevant roles are added to a Google Sheets tracking list for manual follow-up and can also be selected directly in the cover-letter generator.

![StackRadar Automated Job Screening](./docs/skillmatch.png)

### 3. Tailored Cover Letter Generation

Once a relevant role has been identified, an LLM generates a tailored cover letter by connecting the role's requirements with evidence from the candidate's CV and verified project experience. The draft is automatically checked against predefined writing rules, then presented for review and DOCX download.

![StackRadar Cover Letter Generator](<./docs/Cover Letter Generator.png>)

## System Architecture

StackRadar combines an automated Python data pipeline with a full-stack web application:

- **Data pipeline:** collects job postings, cleans and normalises descriptions, enriches jobs with structured labels, calculates technology-demand rankings, and runs career-direction screening for new Junior roles.
- **Database:** stores processed job data, screening results, technology rankings, and platform statistics in PostgreSQL.
- **Backend:** exposes REST APIs for job discovery, analytics, authentication, LLM analysis, and cover-letter generation through ASP.NET Core.
- **Frontend:** provides the Tech Trends, Job Explorer, administration, and cover-letter workflows through JavaScript and Tailwind CSS.
- **Cloud deployment:** runs the pipeline and application components using Azure services.

> **Image placeholder:** Replace the previous architecture diagram with an updated version that includes career-direction screening, matched-job storage, CV extraction, the Cover Letter API, validation/retry, and DOCX output. Suggested file: `docs/system_architecture_v2.png`.

## AI and Machine Learning Highlights

### LLM-Based Job Screening

The screening workflow uses an LLM to interpret job descriptions and evaluate whether a role aligns with predefined career directions. Its responses follow a structured format and are validated before being stored, with invalid or incomplete results retried automatically.

### Grounded Cover-Letter Generation

The generator connects the role's requirements with relevant evidence from the candidate's CV and project experience. Each draft is checked against predefined writing rules and automatically revised when necessary.

### Hybrid Job-Level Classification

The job-level classification pipeline is designed around how people typically infer a role's seniority. It follows the same underlying logic: first look for explicit level terms in the job title; if the title is inconclusive, examine relevant contextual signals in the job description. These signals are then converted into sentence embeddings and classified by a custom-trained MLP model.

![Job Level Classification Pipeline](./docs/Classification_Pipeline_Flow.jpeg)

## Technology Stack

| Layer | Technologies |
| --- | --- |
| AI and NLP | OpenAI API, structured LLM outputs, prompt engineering, Sentence Transformers, text embeddings |
| Machine Learning | PyTorch, custom MLP classifier, PCA and t-SNE evaluation |
| Data Pipeline | Python, Pandas, Beautiful Soup, automated ETL and enrichment workflows |
| Backend | C#, .NET 8, ASP.NET Core Web API, JWT authentication |
| Frontend | JavaScript, HTML, Tailwind CSS |
| Data and Cloud | PostgreSQL, Azure Functions, Azure App Service, Azure Static Web Apps |
| Document Processing | Open XML SDK, DOCX text extraction and generation |

## Project Structure

```text
StackTrend/
├── 01_backend/                  # ASP.NET Core APIs and cover-letter services
├── 02_frontend/                 # Browser-based user interface
├── python_scraper/              # Collection, enrichment, analytics, and screening pipeline
├── model_pipeline/              # Job-level model training and experiments
├── tests/                       # Python pipeline tests
├── docs/                        # Screenshots, diagrams, and project documentation
└── scraper_entry.py              # End-to-end pipeline entry point
```

## Limitations and Future Improvements

StackRadar is currently personalised around a single candidate profile and a predefined set of career directions. To generalise the system for other job seekers, candidate context, screening criteria, and cover-letter preferences could be moved into user-managed profiles. Application tracking could also be added to extend the workflow beyond opportunity discovery and document preparation.

The current dataset focuses on New Zealand technology roles, so its market insights reflect this geographic and occupational context.

## Live Demo

Explore technology demand, discover relevant roles, and generate a tailored application through one connected workflow:

**[Try StackRadar Live →](https://www.stackradar.me)**

## License

This project is available under the terms of the [LICENSE](./LICENSE) file.
