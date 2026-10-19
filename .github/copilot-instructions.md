# Any-Practitioner-Teacher — Copilot Coding Agent Instructions

## Overview

This is an interactive quiz and study platform for **any subject**. Quiz data lives as individual JSON files in the `questions/` directory. Users may drop raw/unformatted content into the `unformatted/` directory for processing.

## Your Task: Process Unformatted Files

When a file (`.json`, `.txt`, `.md`, or any text file) appears in the `unformatted/` directory, you must:

### Step 1 — Understand the Content

- Read the file and determine what topic(s) it covers.
- The content may be raw questions, study notes, bullet points, exam dumps, or any unstructured text about any subject.
- Identify all questions, answers, and explanations present in the file.

### Step 2 — Check for Duplicates

- Read **all** existing JSON files in `questions/` to understand what questions already exist.
- Compare each new question against existing ones. A question is a duplicate if:
  - The question text is substantially the same (even if worded differently).
  - It tests the exact same concept with the same answer options.
- **Do NOT add duplicate or near-duplicate questions.** Skip them silently.

### Step 3 — Determine Target Section

- Examine the existing `questions/` files and decide which section best fits the new content.
- Group questions by logical topic or subject area.
- If the content covers a **new topic** that doesn't fit any existing section, create a **new JSON file** in `questions/` with an appropriate `id`, `title`, `icon`, and `description`.

### Step 4 — Fill in Missing Data

If the source material is incomplete (e.g., questions without explanations, or just study notes without questions), you must **research and generate** the missing parts:

- **Missing explanations:** Write a clear, concise explanation of why the correct answer is right.
- **Missing wrong options:** Create 3 plausible but incorrect answer options. They should be realistic enough to challenge students.
- **Missing questions:** If the file contains study notes or topics but no questions, generate at least 5 high-quality multiple-choice questions from the material.
- **Missing documentation:** Write comprehensive HTML study material covering the topic. Follow the format of existing `documentation` fields — use `<h3>`, `<h4>`, `<p>`, `<ul>`, `<ol>`, `<li>`, `<strong>` tags.
- **Missing follow-up questions:** Generate at least 5 follow-up questions that cover the key concepts in the documentation.

### Step 5 — Format the Output

Questions may be **mcq** (default), **text**, or **code**. Mix formats when it improves learning — especially for interview/job-prep sections (scenarios, commands, short code).

**Multiple choice (`type` omitted or `"mcq"`):**

```json
{
  "id": <sequential_number>,
  "type": "mcq",
  "question": "Question text here?",
  "options": [
    "Option A",
    "Option B",
    "Option C",
    "Option D"
  ],
  "correct": <0-3>,
  "explanation": "Clear explanation of why the correct answer is right."
}
```

**Open text (`"type": "text"`)** — logical / scenario answers:

```json
{
  "id": <sequential_number>,
  "type": "text",
  "question": "What would you check next?",
  "scenario": "Optional setup context shown above the question.",
  "hint": "Optional hint",
  "acceptedAnswers": ["optional exact-ish phrases"],
  "answerPatterns": ["optional regex"],
  "keywords": [["all", "words"], ["or", "this", "group"]],
  "modelAnswer": "Shown after a wrong attempt",
  "explanation": "Why this is right / what good answers include."
}
```

Grading: normalized match against `acceptedAnswers`, any `answerPatterns` regex, or any keyword group (AND within group, OR across groups). Provide at least one of those three.

**Code (`"type": "code"`)** — commands or short programs:

```json
{
  "id": <sequential_number>,
  "type": "code",
  "language": "python",
  "question": "Write a function that…",
  "starterCode": "def foo():\n    ",
  "placeholder": "Optional placeholder",
  "acceptedAnswers": ["…"],
  "answerPatterns": ["…"],
  "modelAnswer": "…",
  "explanation": "…"
}
```

Follow-up questions support the same types (`mcq` / `text` / `code`) and should include `explanation` for open answers.

```json
{
  "type": "text",
  "question": "Follow-up?",
  "acceptedAnswers": ["…"],
  "explanation": "…"
}
```

The complete section JSON file format is:

```json
{
  "id": "section-id-kebab-case",
  "title": "Section Display Title",
  "icon": "📚",
  "description": "Brief description shown on the section card",
  "questions": [ ... ],
  "documentation": "<h3>Title</h3><p>HTML study content...</p>",
  "followUpQuestions": [ ... ],
  "tutorial": {
    "intro": "Short hook shown on the Learn path",
    "levels": [
      {
        "id": "basics",
        "title": "Basics",
        "badge": "🌱",
        "minutes": 15,
        "tagline": "One-line promise",
        "html": "<p>Teaching HTML…</p>"
      },
      {
        "id": "advanced",
        "title": "Advanced",
        "badge": "🚀",
        "minutes": 20,
        "tagline": "…",
        "html": "…"
      },
      {
        "id": "expert",
        "title": "Expert",
        "badge": "🏆",
        "minutes": 20,
        "tagline": "…",
        "html": "…"
      }
    ],
    "resources": [
      {
        "title": "Free resource name",
        "url": "https://…",
        "source": "Publisher",
        "note": "Why a learner should open it"
      }
    ]
  }
}
```

`tutorial` is **optional** but strongly recommended for job-prep / deep technical sections. Use engaging HTML (`tutorial-callout tip|lab|pitfall|interview`, `<pre>`, checklists). Always include real **free** external resources (official docs, well-known free courses). Levels must progress Basics → Advanced → Expert with enough depth to answer the section’s questions and build working fluency.

### Step 6 — Distribute Correct Answers

**IMPORTANT:** Do NOT put all correct answers in the same position. Distribute `correct` values (0, 1, 2, 3) roughly evenly across all questions. This prevents students from guessing patterns.

### Step 7 — Update the Section File

- If adding to an existing section: read the current file, append the new (non-duplicate) questions to the `questions` array, update question `id` numbers to be sequential, and write the file back.
- If creating a new section: create the complete JSON file with all required fields.

### Step 8 — Regenerate Manifest

After modifying or creating question files, run:

```bash
node generate-manifest.js
```

This updates `questions/manifest.json` so the app discovers all section files.

### Step 9 — Delete the Processed File

After successfully processing and integrating the content, **delete the original file from the `unformatted/` directory**. Do not leave processed files behind.

### Step 10 — Commit and Summarize

Commit all changes with a descriptive message, for example:
```
Add 15 new questions to security-compliance from uploaded study notes
```

In your PR description, include:
- How many questions were added (and to which sections)
- How many duplicates were skipped
- Whether any new sections were created
- Whether any data was researched and generated (missing explanations, questions from notes, etc.)

## Quality Standards

- All questions must be factually accurate and relevant to the subject being studied.
- Explanations should be educational — not just "the answer is X" but WHY it's correct.
- Wrong options should be plausible. Avoid obviously absurd distractors.
- **Balance option lengths** (MCQ only). Do not make the correct answer systematically the longest. Distractors should be roughly similar in length and specificity to the correct option (e.g. avoid pairing a full definition with short labels like "A database service"). Across a section, the uniquely longest option should be correct roughly ~25% of the time (near chance for 4 options), not the majority of questions.
- **Prefer mixed formats for job-prep / deep technical sections:** include scenario `text` questions and short `code` prompts alongside MCQs so learners practice explanation and tooling, not only recognition.
- Each section should have at least 5 `followUpQuestions`.
- Documentation HTML should be well-structured and comprehensive.

## File Validation

Before committing, verify your JSON is valid by running:

```bash
node generate-manifest.js
```

If any file fails validation, fix it before committing. The script will report which files have issues and what fields are missing.
