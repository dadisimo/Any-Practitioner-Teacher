#!/usr/bin/env node

/**
 * Generates manifest.json for the questions directory.
 * 
 * Run this script whenever you add, remove, or rename JSON files
 * in the questions/ directory:
 * 
 *   node generate-manifest.js
 * 
 * This creates questions/manifest.json which tells the app
 * which quiz files to load.
 * 
 * Works for Any-Practitioner-Teacher — subject-agnostic.
 */

const fs = require('fs');
const path = require('path');

const questionsDir = path.join(__dirname, 'questions');
const manifestPath = path.join(questionsDir, 'manifest.json');

// Required fields for validation
const REQUIRED_FIELDS = ['id', 'title', 'icon', 'description', 'questions', 'documentation', 'followUpQuestions'];

function getQuestionType(question) {
    return question.type || 'mcq';
}

function isValidQuestion(question, label) {
    if (!question || !question.question) {
        return `${label}: missing question text`;
    }
    const type = getQuestionType(question);
    if (type === 'mcq') {
        if (!Array.isArray(question.options) || typeof question.correct !== 'number') {
            return `${label}: mcq requires options[] and correct index`;
        }
        return null;
    }
    if (type === 'text' || type === 'code') {
        if (!question.explanation) {
            return `${label}: ${type} requires explanation`;
        }
        const hasAccepted = Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length > 0;
        const hasPatterns = Array.isArray(question.answerPatterns) && question.answerPatterns.length > 0;
        const hasKeywords = Array.isArray(question.keywords) && question.keywords.length > 0;
        if (!hasAccepted && !hasPatterns && !hasKeywords) {
            return `${label}: ${type} requires acceptedAnswers, answerPatterns, or keywords`;
        }
        return null;
    }
    return `${label}: unknown type "${type}"`;
}

// Read all .json files from the questions directory (excluding manifest.json)
const files = fs.readdirSync(questionsDir)
    .filter(file => file.endsWith('.json') && file !== 'manifest.json')
    .sort();

console.log(`Found ${files.length} JSON file(s) in questions/`);

const validFiles = [];
const errors = [];

for (const file of files) {
    const filePath = path.join(questionsDir, file);
    try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Validate required fields
        const missingFields = REQUIRED_FIELDS.filter(field => !(field in content));
        if (missingFields.length > 0) {
            errors.push(`  ❌ ${file}: Missing fields: ${missingFields.join(', ')}`);
            continue;
        }
        
        // Validate questions array
        if (!Array.isArray(content.questions) || content.questions.length === 0) {
            errors.push(`  ❌ ${file}: questions must be a non-empty array`);
            continue;
        }
        
        // Validate each question
        let questionsValid = true;
        for (let i = 0; i < content.questions.length; i++) {
            const err = isValidQuestion(content.questions[i], `question[${i}]`);
            if (err) {
                errors.push(`  ❌ ${file}: ${err}`);
                questionsValid = false;
                break;
            }
        }
        if (!questionsValid) continue;
        
        // Validate followUpQuestions
        if (!Array.isArray(content.followUpQuestions)) {
            errors.push(`  ❌ ${file}: followUpQuestions must be an array`);
            continue;
        }

        let followUpsValid = true;
        for (let i = 0; i < content.followUpQuestions.length; i++) {
            const err = isValidQuestion(content.followUpQuestions[i], `followUp[${i}]`);
            if (err) {
                errors.push(`  ❌ ${file}: ${err}`);
                followUpsValid = false;
                break;
            }
        }
        if (!followUpsValid) continue;
        
        validFiles.push(file);
        const types = {};
        for (const q of [...content.questions, ...content.followUpQuestions]) {
            const t = getQuestionType(q);
            types[t] = (types[t] || 0) + 1;
        }
        const typeSummary = Object.entries(types).map(([k, v]) => `${v} ${k}`).join(', ');
        console.log(`  ✅ ${file} (${content.questions.length} questions, ${content.followUpQuestions.length} follow-ups; ${typeSummary})`);
    } catch (e) {
        errors.push(`  ❌ ${file}: ${e.message}`);
    }
}

if (errors.length > 0) {
    console.log('\nSkipped files with errors:');
    errors.forEach(e => console.log(e));
}

// Write manifest
const manifest = {
    files: validFiles,
    generated: new Date().toISOString()
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n✅ Generated manifest.json with ${validFiles.length} valid section(s)`);
