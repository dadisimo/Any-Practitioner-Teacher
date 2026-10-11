# Quiz Questions Directory

This directory contains all quiz sections as individual JSON files. The app automatically loads all `.json` files from this directory.

## Adding New Quiz Sections

To add a new quiz section:

1. Create a new `.json` file in this directory (e.g., `my-new-section.json`)
2. Follow the JSON structure below
3. The app will automatically detect and load it on the next page refresh

## JSON File Structure

Each JSON file must have the following structure:

```json
{
  "id": "unique-section-id",
  "title": "Section Title",
  "icon": "📚",
  "description": "Brief description of what this section covers",
  "questions": [
    {
      "id": 1,
      "question": "Your question text here?",
      "options": [
        "Option 1",
        "Option 2",
        "Option 3",
        "Option 4"
      ],
      "correct": 0,
      "explanation": "Explanation of why this answer is correct"
    }
  ],
  "documentation": "<h3>Study Material</h3><p>HTML content with detailed explanations...</p>",
  "followUpQuestions": [
    {
      "question": "Follow-up question text?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correct": 2
    }
  ]
}
```

## Field Descriptions

### Required Fields

- **id** (string): Unique identifier for the section (kebab-case recommended)
- **title** (string): Display title for the section
- **icon** (string): Emoji or icon to represent the section
- **description** (string): Brief description shown on the section card
- **questions** (array): Array of main quiz questions
- **documentation** (string): HTML content for study material (shown when user gets a question wrong)
- **followUpQuestions** (array): Array of practice questions after studying documentation

### Question Object Structure

Main questions require:
- **id** (number): Sequential question number
- **question** (string): The question text
- **options** (array): Array of 4 answer options
- **correct** (number): Index of the correct answer (0-3)
- **explanation** (string): Explanation shown after answering

Follow-up questions require:
- **question** (string): The question text
- **options** (array): Array of 4 answer options
- **correct** (number): Index of the correct answer (0-3)

## Validation

The app validates each JSON file to ensure:
- All required fields are present
- Questions array is not empty
- Each question has valid options and correct answer index
- FollowUpQuestions is an array

Invalid files will be logged to the console and skipped.

## Current Sections

- `cloud-concepts.json` - Cloud Concepts & Architecture
- `security-compliance.json` - Security & Compliance
- `technology-services.json` - Technology & Services
- `billing-pricing.json` - Billing & Pricing
- `management-governance.json` - Management & Governance
- `kubernetes-fundamentals.json` - Kubernetes Fundamentals
- `kubernetes-advanced.json` - Kubernetes Advanced
