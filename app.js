// Global data object
let appData = {
    sections: []
};

// State Management
let state = {
    currentSection: null,
    currentQuestionIndex: 0,
    wrongAnswers: [],
    sectionProgress: {},
    followUpCorrect: 0,
    followUpQuestions: [],
    followUpIndex: 0,
    completedSections: [],
    pausedAtQuestion: null,  // Track where we paused the quiz
    needsRemediation: false, // Flag to know if we need to show doc + follow-up
    previousScreen: null,    // Track screen to return to from stats
    tutorialLevelIndex: 0,
    tutorialProgress: {},    // { sectionId: { basics: true, advanced: true, expert: true } }
    tutorialReturnTo: null   // 'quiz' | 'docs' | null
};

function getQuestionType(question) {
    return question.type || 'mcq';
}

function isValidQuestion(question) {
    if (!question || !question.question) return false;
    const type = getQuestionType(question);
    if (type === 'mcq') {
        return Array.isArray(question.options) && typeof question.correct === 'number';
    }
    if (type === 'text' || type === 'code') {
        if (!question.explanation) return false;
        const hasAccepted = Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length > 0;
        const hasPatterns = Array.isArray(question.answerPatterns) && question.answerPatterns.length > 0;
        const hasKeywords = Array.isArray(question.keywords) && question.keywords.length > 0;
        return hasAccepted || hasPatterns || hasKeywords;
    }
    return false;
}

// Validate section format
function validateSection(section) {
    if (!section || typeof section !== 'object') return false;
    
    const requiredFields = ['id', 'title', 'icon', 'description', 'questions', 'documentation', 'followUpQuestions'];
    for (const field of requiredFields) {
        if (!(field in section)) {
            console.warn(`Section missing required field: ${field}`);
            return false;
        }
    }
    
    // Validate questions array
    if (!Array.isArray(section.questions) || section.questions.length === 0) {
        console.warn(`Section ${section.id} has invalid questions array`);
        return false;
    }
    
    // Validate each question has required fields for its type
    for (const question of section.questions) {
        if (!isValidQuestion(question)) {
            console.warn(`Invalid question in section ${section.id}`);
            return false;
        }
    }
    
    // Validate followUpQuestions
    if (!Array.isArray(section.followUpQuestions)) {
        console.warn(`Section ${section.id} has invalid followUpQuestions`);
        return false;
    }

    for (const question of section.followUpQuestions) {
        if (!isValidQuestion(question)) {
            console.warn(`Invalid follow-up question in section ${section.id}`);
            return false;
        }
    }
    
    return true;
}

function normalizeTextAnswer(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[^a-z0-9\s_+\-./<>*()=&|!?:;,{}[\]]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeCodeAnswer(value) {
    return String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\t/g, ' ')
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(line => line.length > 0 && !line.startsWith('#'))
        .join('\n')
        .toLowerCase()
        .trim();
}

function gradeOpenAnswer(question, rawAnswer) {
    const type = getQuestionType(question);
    const normalized = type === 'code'
        ? normalizeCodeAnswer(rawAnswer)
        : normalizeTextAnswer(rawAnswer);

    if (!normalized) return false;

    const accepted = question.acceptedAnswers || [];
    for (const candidate of accepted) {
        const expected = type === 'code'
            ? normalizeCodeAnswer(candidate)
            : normalizeTextAnswer(candidate);
        if (expected && (normalized === expected || normalized.includes(expected) || expected.includes(normalized))) {
            return true;
        }
    }

    const patterns = question.answerPatterns || [];
    for (const pattern of patterns) {
        try {
            if (new RegExp(pattern, 'i').test(rawAnswer) || new RegExp(pattern, 'i').test(normalized)) {
                return true;
            }
        } catch (e) {
            console.warn('Invalid answerPattern:', pattern, e);
        }
    }

    const keywordGroups = question.keywords || [];
    if (keywordGroups.length > 0) {
        // Each group is an OR alternative; within a group all keywords must appear (AND).
        return keywordGroups.some(group => {
            const words = Array.isArray(group) ? group : [group];
            return words.every(word => normalized.includes(normalizeTextAnswer(word)));
        });
    }

    return false;
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderQuestionPrompt(question) {
    const type = getQuestionType(question);
    const badge = type === 'mcq'
        ? ''
        : `<span class="question-type-badge">${type === 'code' ? 'Code' : 'Open answer'}</span>`;
    const scenario = question.scenario
        ? `<div class="question-scenario">${question.scenario}</div>`
        : '';
    const hint = question.hint
        ? `<p class="question-hint">${escapeHtml(question.hint)}</p>`
        : '';
    return `${badge}<div class="question">${question.question}</div>${scenario}${hint}`;
}

function renderOpenAnswerControls(question, submitHandlerName) {
    const type = getQuestionType(question);
    const placeholder = escapeHtml(question.placeholder || (type === 'code'
        ? 'Write your code or command here…'
        : 'Type your answer…'));
    const starter = question.starterCode || '';
    const rows = type === 'code' ? 8 : 4;
    const lang = escapeHtml(question.language || '');
    return `
        <div class="open-answer ${type === 'code' ? 'code-answer' : 'text-answer'}">
            ${lang ? `<div class="code-lang">${lang}</div>` : ''}
            <textarea id="open-answer-input" class="open-answer-input" rows="${rows}" placeholder="${placeholder}" spellcheck="${type !== 'code'}">${escapeHtml(starter)}</textarea>
            <button class="btn btn-primary submit-answer-btn" onclick="${submitHandlerName}()">Submit Answer</button>
        </div>
        <div id="feedback"></div>
    `;
}

// Load all JSON files from the questions directory
async function loadQuestionData() {
    try {
        // Load the manifest file that lists all available JSON files
        const manifestResponse = await fetch('questions/manifest.json');
        if (!manifestResponse.ok) {
            throw new Error('Could not load questions/manifest.json. Run: node generate-manifest.js');
        }
        const manifest = await manifestResponse.json();
        const jsonFiles = manifest.files || [];
        
        if (jsonFiles.length === 0) {
            throw new Error('No question files listed in manifest.json');
        }
        
        // Load all JSON files in parallel
        const loadPromises = jsonFiles.map(async (filename) => {
            try {
                const response = await fetch(`questions/${filename}`);
                if (!response.ok) {
                    console.warn(`Failed to load ${filename}: ${response.status}`);
                    return null;
                }
                const section = await response.json();
                
                // Validate the section format
                if (validateSection(section)) {
                    return section;
                } else {
                    console.warn(`Invalid section format in ${filename}`);
                    return null;
                }
            } catch (error) {
                console.warn(`Error loading ${filename}:`, error);
                return null;
            }
        });
        
        const sections = await Promise.all(loadPromises);
        
        // Filter out null values and add to appData
        appData.sections = sections.filter(section => section !== null);
        
        if (appData.sections.length === 0) {
            throw new Error('No valid question sections loaded');
        }
        
        console.log(`Loaded ${appData.sections.length} question sections`);
        return true;
    } catch (error) {
        console.error('Error loading question data:', error);
        alert('Error loading quiz data. Please refresh the page.');
        return false;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Show loading state
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.innerHTML += '<p>Loading quiz data...</p>';
    }
    
    // Load question data from JSON files
    const loaded = await loadQuestionData();
    
    if (loaded) {
        loadProgress();
        renderSections();
        populateWelcomeSections();
        trackVisit();
        
        // Remove loading message
        if (welcomeScreen) {
            const loadingMsg = welcomeScreen.querySelector('p:last-child');
            if (loadingMsg && loadingMsg.textContent === 'Loading quiz data...') {
                loadingMsg.remove();
            }
        }
    }
});

// Save progress to localStorage
function saveProgress() {
    localStorage.setItem('practitionerProgress', JSON.stringify(state));
}

// Load progress from localStorage
function loadProgress() {
    const saved = localStorage.getItem('practitionerProgress') || localStorage.getItem('awsPractitionerProgress');
    if (saved) {
        const savedState = JSON.parse(saved);
        state.sectionProgress = savedState.sectionProgress || {};
        state.completedSections = savedState.completedSections || [];
        state.tutorialProgress = savedState.tutorialProgress || {};
    }
}

function sectionHasTutorial(section) {
    return !!(section && section.tutorial && Array.isArray(section.tutorial.levels) && section.tutorial.levels.length > 0);
}

function getTutorialLevels(section) {
    return sectionHasTutorial(section) ? section.tutorial.levels : [];
}

function markTutorialLevelVisited(sectionId, levelId) {
    if (!state.tutorialProgress[sectionId]) state.tutorialProgress[sectionId] = {};
    state.tutorialProgress[sectionId][levelId] = true;
    saveProgress();
}

function openSection(sectionId) {
    const section = appData.sections.find(s => s.id === sectionId);
    if (!section) return;

    state.currentSection = section;
    state.tutorialReturnTo = null;

    if (sectionHasTutorial(section)) {
        state.tutorialLevelIndex = 0;
        showTutorial();
    } else {
        startSection(sectionId);
    }
}

function showTutorial() {
    const section = state.currentSection;
    if (!sectionHasTutorial(section)) {
        startSection(section.id);
        return;
    }

    const levels = getTutorialLevels(section);
    if (state.tutorialLevelIndex < 0) state.tutorialLevelIndex = 0;
    if (state.tutorialLevelIndex >= levels.length) state.tutorialLevelIndex = levels.length - 1;

    document.getElementById('tutorial-title').textContent = `${section.icon} ${section.title}`;
    document.getElementById('tutorial-intro').textContent = section.tutorial.intro || section.description;

    const tabs = document.getElementById('tutorial-level-tabs');
    tabs.innerHTML = levels.map((level, index) => {
        const done = !!(state.tutorialProgress[section.id] && state.tutorialProgress[section.id][level.id]);
        const active = index === state.tutorialLevelIndex ? 'active' : '';
        const doneClass = done ? 'done' : '';
        return `
            <button class="tutorial-tab ${active} ${doneClass}" onclick="setTutorialLevel(${index})">
                <span class="tab-badge">${level.badge || (index + 1)}</span>
                <span class="tab-copy">
                    <strong>${escapeHtml(level.title)}</strong>
                    <small>${level.minutes ? `~${level.minutes} min` : 'Learn'}${done ? ' · done' : ''}</small>
                </span>
            </button>
        `;
    }).join('');

    const level = levels[state.tutorialLevelIndex];
    markTutorialLevelVisited(section.id, level.id);

    const progress = document.getElementById('tutorial-progress');
    const visitedCount = levels.filter(l => state.tutorialProgress[section.id] && state.tutorialProgress[section.id][l.id]).length;
    progress.innerHTML = `
        <div class="tutorial-progress-track">
            <div class="tutorial-progress-fill" style="width:${(visitedCount / levels.length) * 100}%"></div>
        </div>
        <p class="tutorial-progress-label">Path progress: ${visitedCount} / ${levels.length} levels explored</p>
    `;

    document.getElementById('tutorial-body').innerHTML = `
        <div class="tutorial-level-banner level-${escapeHtml(level.id)}">
            <span>${level.badge || ''} ${escapeHtml(level.title)}</span>
            ${level.tagline ? `<em>${escapeHtml(level.tagline)}</em>` : ''}
        </div>
        ${level.html}
    `;

    document.getElementById('tutorial-prev-btn').disabled = state.tutorialLevelIndex === 0;
    const nextBtn = document.getElementById('tutorial-next-btn');
    if (state.tutorialLevelIndex >= levels.length - 1) {
        nextBtn.textContent = 'Review resources ↓';
        nextBtn.onclick = () => {
            document.getElementById('tutorial-resources').scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
    } else {
        nextBtn.textContent = 'Next level';
        nextBtn.onclick = tutorialNextLevel;
    }

    renderTutorialResources(section);
    showScreen('tutorial-screen');
    window.scrollTo(0, 0);
}

function renderTutorialResources(section) {
    const container = document.getElementById('tutorial-resources');
    const resources = (section.tutorial && section.tutorial.resources) || [];
    if (!resources.length) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <h3>Free tutorials & references</h3>
        <p class="resources-lead">Go deeper with popular free materials. Use these after (or alongside) the path above.</p>
        <div class="resource-grid">
            ${resources.map(r => `
                <a class="resource-card" href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">
                    <div class="resource-source">${escapeHtml(r.source || 'Free')}</div>
                    <strong>${escapeHtml(r.title)}</strong>
                    <p>${escapeHtml(r.note || '')}</p>
                    <span class="resource-link">Open ↗</span>
                </a>
            `).join('')}
        </div>
    `;
}

function setTutorialLevel(index) {
    state.tutorialLevelIndex = index;
    showTutorial();
}

function tutorialPrevLevel() {
    if (state.tutorialLevelIndex > 0) {
        state.tutorialLevelIndex--;
        showTutorial();
    }
}

function tutorialNextLevel() {
    const levels = getTutorialLevels(state.currentSection);
    if (state.tutorialLevelIndex < levels.length - 1) {
        state.tutorialLevelIndex++;
        showTutorial();
    }
}

function startQuizFromTutorial() {
    if (!state.currentSection) return;
    startSection(state.currentSection.id);
}

function openTutorialFromQuiz() {
    if (!state.currentSection || !sectionHasTutorial(state.currentSection)) return;
    state.tutorialReturnTo = 'quiz';
    showTutorial();
}

function openTutorialFromDocs() {
    if (!state.currentSection || !sectionHasTutorial(state.currentSection)) return;
    state.tutorialReturnTo = 'docs';
    showTutorial();
}

// Populate the welcome screen sections list dynamically
function populateWelcomeSections() {
    const list = document.getElementById('welcome-sections-list');
    if (!list) return;
    list.innerHTML = appData.sections.map(s =>
        `<li>${s.icon} ${s.title}</li>`
    ).join('');
}

// Show a specific screen
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
    
    // Show progress bar except on welcome screen
    const progressContainer = document.getElementById('progress-container');
    if (screenId !== 'welcome-screen') {
        progressContainer.classList.add('visible');
        updateProgress();
    } else {
        progressContainer.classList.remove('visible');
    }
}

// Start learning journey
function startLearning() {
    showScreen('section-screen');
}

// Render section cards
function renderSections() {
    const container = document.getElementById('sections-container');
    container.innerHTML = '';
    
    appData.sections.forEach(section => {
        const isCompleted = state.completedSections.includes(section.id);
        const hasTutorial = sectionHasTutorial(section);
        const card = document.createElement('div');
        card.className = `section-card ${isCompleted ? 'completed' : ''} ${hasTutorial ? 'has-tutorial' : ''}`;
        
        const levels = hasTutorial ? getTutorialLevels(section) : [];
        const visited = (state.tutorialProgress[section.id] || {});
        const visitedCount = levels.filter(l => visited[l.id]).length;

        card.innerHTML = `
            <div class="icon">${section.icon}</div>
            <h3>${section.title}</h3>
            <p>${section.description}</p>
            ${hasTutorial ? `<div class="learn-path-pill">Learn path · ${visitedCount}/${levels.length} levels</div>` : ''}
            <div class="section-card-actions">
                ${hasTutorial ? `<button class="btn btn-primary btn-small" data-action="learn">Learn</button>` : ''}
                <button class="btn btn-secondary btn-small" data-action="quiz">${hasTutorial ? 'Quiz' : 'Start'}</button>
            </div>
            <span class="status">${isCompleted ? '✅' : ''}</span>
        `;

        card.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (btn.dataset.action === 'learn') openSection(section.id);
                else startSection(section.id);
            });
        });
        card.addEventListener('click', () => openSection(section.id));
        
        container.appendChild(card);
    });
}

// Shuffle question options and update correct answer index (MCQ only)
function shuffleQuestionOptions(question) {
    if (getQuestionType(question) !== 'mcq') {
        return { ...question };
    }

    // Create array of [option, isCorrect] pairs
    const optionsWithCorrectFlag = question.options.map((option, index) => ({
        option: option,
        isCorrect: index === question.correct
    }));
    
    // Shuffle the options
    const shuffled = shuffleArray(optionsWithCorrectFlag);
    
    // Extract shuffled options and find new correct index
    const shuffledOptions = shuffled.map(item => item.option);
    const newCorrectIndex = shuffled.findIndex(item => item.isCorrect);
    
    return {
        ...question,
        options: shuffledOptions,
        correct: newCorrectIndex
    };
}

// Start a section
function startSection(sectionId) {
    const section = appData.sections.find(s => s.id === sectionId);
    if (!section) return;
    
    // Create a shuffled copy of questions for this session
    const shuffledQuestions = shuffleArray([...section.questions]);
    
    // Shuffle options for each question
    const questionsWithShuffledOptions = shuffledQuestions.map(q => shuffleQuestionOptions(q));
    
    state.currentSection = {
        ...section,
        questions: questionsWithShuffledOptions
    };
    state.currentQuestionIndex = 0;
    state.wrongAnswers = [];
    
    showQuiz();
}

// Show quiz screen
function showQuiz() {
    const section = state.currentSection;
    document.getElementById('quiz-title').textContent = section.title;
    const tutorialBtn = document.getElementById('quiz-open-tutorial-btn');
    if (tutorialBtn) {
        tutorialBtn.hidden = !sectionHasTutorial(section);
    }
    showScreen('quiz-screen');
    displayQuestion();
}

function showAnswerOutcome(feedbackDiv, question, isCorrect, onCorrect, onIncorrect) {
    feedbackDiv.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
    const modelAnswer = question.modelAnswer
        ? `<div class="model-answer"><strong>Model answer:</strong><pre>${escapeHtml(question.modelAnswer)}</pre></div>`
        : '';
    feedbackDiv.innerHTML = `
        <strong>${isCorrect ? '✓ Correct!' : '✗ Incorrect'}</strong>
        <p>${question.explanation}</p>
        ${isCorrect ? '' : modelAnswer}
    `;

    if (!isCorrect) {
        onIncorrect();
    } else {
        onCorrect();
    }
}

// Display current question
function displayQuestion() {
    const section = state.currentSection;
    const question = section.questions[state.currentQuestionIndex];
    const type = getQuestionType(question);
    
    document.getElementById('question-counter').textContent = 
        `Question ${state.currentQuestionIndex + 1} of ${section.questions.length}`;
    
    const container = document.getElementById('question-container');
    if (type === 'mcq') {
        container.innerHTML = `
            ${renderQuestionPrompt(question)}
            <div class="answers">
                ${question.options.map((option, index) => `
                    <button class="answer-btn" onclick="selectAnswer(${index})">${option}</button>
                `).join('')}
            </div>
            <div id="feedback"></div>
        `;
    } else {
        container.innerHTML = `
            ${renderQuestionPrompt(question)}
            ${renderOpenAnswerControls(question, 'submitOpenAnswer')}
        `;
        const input = document.getElementById('open-answer-input');
        if (input) input.focus();
    }
}

// Handle MCQ answer selection
function selectAnswer(selectedIndex) {
    const section = state.currentSection;
    const question = section.questions[state.currentQuestionIndex];
    const answerButtons = document.querySelectorAll('.answer-btn');
    const feedbackDiv = document.getElementById('feedback');
    
    // Disable all buttons
    answerButtons.forEach(btn => btn.disabled = true);
    
    // Check if answer is correct
    const isCorrect = selectedIndex === question.correct;
    
    // Highlight selected answer
    answerButtons[selectedIndex].classList.add(isCorrect ? 'correct' : 'incorrect');
    answerButtons[question.correct].classList.add('correct');

    finishMainQuestion(feedbackDiv, question, isCorrect);
}

// Handle text/code answer submission
function submitOpenAnswer() {
    const section = state.currentSection;
    const question = section.questions[state.currentQuestionIndex];
    const input = document.getElementById('open-answer-input');
    const feedbackDiv = document.getElementById('feedback');
    if (!input || !feedbackDiv) return;

    const rawAnswer = input.value;
    const isCorrect = gradeOpenAnswer(question, rawAnswer);
    input.disabled = true;
    const submitBtn = document.querySelector('.submit-answer-btn');
    if (submitBtn) submitBtn.disabled = true;
    input.classList.add(isCorrect ? 'correct' : 'incorrect');

    finishMainQuestion(feedbackDiv, question, isCorrect);
}

function finishMainQuestion(feedbackDiv, question, isCorrect) {
    const section = state.currentSection;
    showAnswerOutcome(
        feedbackDiv,
        question,
        isCorrect,
        () => {
            const nextButton = document.createElement('button');
            nextButton.className = 'btn btn-primary next-btn';
            nextButton.textContent = state.currentQuestionIndex < section.questions.length - 1
                ? 'Next Question'
                : 'Complete Quiz';
            nextButton.onclick = nextQuestion;
            feedbackDiv.appendChild(nextButton);
        },
        () => {
            if (!state.wrongAnswers.some(w => w.questionIndex === state.currentQuestionIndex)) {
                state.wrongAnswers.push({
                    questionIndex: state.currentQuestionIndex,
                    question: question
                });
            }
            const docButton = document.createElement('button');
            docButton.className = 'btn btn-primary next-btn';
            docButton.textContent = 'Study Documentation';
            docButton.onclick = () => {
                state.pausedAtQuestion = state.currentQuestionIndex;
                state.needsRemediation = true;
                showDocumentation();
            };
            feedbackDiv.appendChild(docButton);
        }
    );
    saveProgress();
}

// Move to next question
function nextQuestion() {
    const section = state.currentSection;
    
    if (state.currentQuestionIndex < section.questions.length - 1) {
        state.currentQuestionIndex++;
        displayQuestion();
    } else {
        // Quiz completed - all correct!
        completeSection();
    }
}

// Show documentation
function showDocumentation() {
    const section = state.currentSection;
    
    document.getElementById('doc-title').textContent = `${section.title} - Study Guide`;
    document.getElementById('doc-content').innerHTML = section.documentation;

    const tutorialBtn = document.getElementById('doc-open-tutorial-btn');
    if (tutorialBtn) {
        tutorialBtn.hidden = !sectionHasTutorial(section);
    }
    
    showScreen('doc-screen');
    
    // Scroll to top
    window.scrollTo(0, 0);
}

// Start follow-up questions
function startFollowUpQuestions() {
    const section = state.currentSection;
    
    // Shuffle follow-up questions and their options
    const shuffledQuestions = shuffleArray([...section.followUpQuestions]);
    state.followUpQuestions = shuffledQuestions.map(q => shuffleQuestionOptions(q));
    state.followUpIndex = 0;
    state.followUpCorrect = 0;
    
    showScreen('followup-screen');
    displayFollowUpQuestion();
    
    // Scroll to top
    window.scrollTo(0, 0);
}

// Display follow-up question
function displayFollowUpQuestion() {
    const question = state.followUpQuestions[state.followUpIndex];
    const type = getQuestionType(question);
    
    document.getElementById('followup-counter').textContent = 
        `Correct: ${state.followUpCorrect} / 3`;
    
    const container = document.getElementById('followup-container');
    if (type === 'mcq') {
        container.innerHTML = `
            ${renderQuestionPrompt(question)}
            <div class="answers">
                ${question.options.map((option, index) => `
                    <button class="answer-btn" onclick="selectFollowUpAnswer(${index})">${option}</button>
                `).join('')}
            </div>
            <div id="followup-feedback"></div>
        `;
    } else {
        container.innerHTML = `
            ${renderQuestionPrompt(question)}
            ${renderOpenAnswerControls(question, 'submitFollowUpOpenAnswer').replace('id="feedback"', 'id="followup-feedback"')}
        `;
        const input = document.getElementById('open-answer-input');
        if (input) input.focus();
    }
}

function handleFollowUpResult(feedbackDiv, question, isCorrect) {
    if (isCorrect) {
        state.followUpCorrect++;
        feedbackDiv.className = 'feedback correct';
        feedbackDiv.innerHTML = `
            <strong>✓ Correct!</strong>
            <p>Great job! ${state.followUpCorrect === 3 ? 'You\'ve answered all 3 correctly!' : `${3 - state.followUpCorrect} more to go!`}</p>
            ${question.explanation ? `<p>${question.explanation}</p>` : ''}
        `;

        if (state.followUpCorrect >= 3) {
            if (state.needsRemediation) {
                state.needsRemediation = false;
                feedbackDiv.innerHTML += `<p><strong>Great! Now let's continue with the quiz.</strong></p>`;
                setTimeout(() => {
                    state.currentQuestionIndex = state.pausedAtQuestion + 1;
                    const section = state.currentSection;
                    if (state.currentQuestionIndex < section.questions.length) {
                        showQuiz();
                    } else {
                        completeSection();
                    }
                }, 2000);
            } else {
                setTimeout(() => {
                    completeSection();
                }, 1500);
            }
        } else {
            const nextButton = document.createElement('button');
            nextButton.className = 'btn btn-primary next-btn';
            nextButton.textContent = 'Next Question';
            nextButton.onclick = nextFollowUpQuestion;
            feedbackDiv.appendChild(nextButton);
        }
    } else {
        feedbackDiv.className = 'feedback incorrect';
        const modelAnswer = question.modelAnswer
            ? `<div class="model-answer"><strong>Model answer:</strong><pre>${escapeHtml(question.modelAnswer)}</pre></div>`
            : '';
        feedbackDiv.innerHTML = `
            <strong>✗ Incorrect</strong>
            <p>Let's review the documentation again.</p>
            ${question.explanation ? `<p>${question.explanation}</p>` : ''}
            ${modelAnswer}
        `;

        setTimeout(() => {
            state.followUpCorrect = 0;
            showDocumentation();
        }, 2500);
    }

    saveProgress();
}

// Handle follow-up MCQ answer selection
function selectFollowUpAnswer(selectedIndex) {
    const question = state.followUpQuestions[state.followUpIndex];
    const answerButtons = document.querySelectorAll('.answer-btn');
    const feedbackDiv = document.getElementById('followup-feedback');
    
    answerButtons.forEach(btn => btn.disabled = true);
    const isCorrect = selectedIndex === question.correct;
    answerButtons[selectedIndex].classList.add(isCorrect ? 'correct' : 'incorrect');
    answerButtons[question.correct].classList.add('correct');
    handleFollowUpResult(feedbackDiv, question, isCorrect);
}

function submitFollowUpOpenAnswer() {
    const question = state.followUpQuestions[state.followUpIndex];
    const input = document.getElementById('open-answer-input');
    const feedbackDiv = document.getElementById('followup-feedback');
    if (!input || !feedbackDiv) return;

    const isCorrect = gradeOpenAnswer(question, input.value);
    input.disabled = true;
    const submitBtn = document.querySelector('.submit-answer-btn');
    if (submitBtn) submitBtn.disabled = true;
    input.classList.add(isCorrect ? 'correct' : 'incorrect');
    handleFollowUpResult(feedbackDiv, question, isCorrect);
}

// Move to next follow-up question
function nextFollowUpQuestion() {
    state.followUpIndex++;
    
    if (state.followUpIndex < state.followUpQuestions.length) {
        displayFollowUpQuestion();
    } else {
        // Need more questions - shuffle and restart
        const shuffledQuestions = shuffleArray([...state.currentSection.followUpQuestions]);
        state.followUpQuestions = shuffledQuestions.map(q => shuffleQuestionOptions(q));
        state.followUpIndex = 0;
        displayFollowUpQuestion();
    }
}

// Complete section
function completeSection() {
    const section = state.currentSection;
    const totalQuestions = section.questions.length;
    const wrongCount = state.wrongAnswers.length;
    const score = Math.round(((totalQuestions - wrongCount) / totalQuestions) * 100);
    
    // Mark section as completed
    if (!state.completedSections.includes(section.id)) {
        state.completedSections.push(section.id);
    }
    
    document.getElementById('completion-message').textContent = 
        `You've successfully mastered ${section.title}!`;
    
    document.getElementById('final-stats').innerHTML = `
        <h3>Your Performance</h3>
        <div class="stat-item">
            <span class="stat-label">Total Questions:</span>
            <span class="stat-value">${totalQuestions}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Initial Score:</span>
            <span class="stat-value">${score}%</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Topics Reviewed:</span>
            <span class="stat-value">${wrongCount > 0 ? wrongCount : 'None - Perfect!'}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Follow-up Questions:</span>
            <span class="stat-value">${wrongCount > 0 ? '3/3 Correct ✓' : 'Not Required'}</span>
        </div>
    `;
    
    saveProgress();
    renderSections(); // Update section cards
    showScreen('completion-screen');
    updateProgress();
}

// Continue to next section
function continueToNextSection() {
    if (state.completedSections.length === appData.sections.length) {
        // All sections completed!
        showFinalCompletion();
    } else {
        showSectionSelection();
    }
}

// Show section selection
function showSectionSelection() {
    showScreen('section-screen');
}

// Show final completion
function showFinalCompletion() {
    const totalSections = appData.sections.length;
    const totalQuestions = appData.sections.reduce((sum, section) => sum + section.questions.length, 0);
    
    document.getElementById('overall-stats').innerHTML = `
        <h3>Overall Achievement</h3>
        <div class="stat-item">
            <span class="stat-label">Sections Completed:</span>
            <span class="stat-value">${totalSections}/${totalSections}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Total Questions Mastered:</span>
            <span class="stat-value">${totalQuestions}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Completion Rate:</span>
            <span class="stat-value">100%</span>
        </div>
    `;
    
    document.getElementById('completion-date').textContent = 
        new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    
    showScreen('final-completion-screen');
}

// Restart course
function restartCourse() {
    if (confirm('This will reset all your progress. Are you sure?')) {
        state.completedSections = [];
        state.sectionProgress = {};
        saveProgress();
        renderSections();
        showScreen('welcome-screen');
    }
}

// Update progress bar
function updateProgress() {
    const totalSections = appData.sections.length;
    const completedCount = state.completedSections.length;
    const percentage = Math.round((completedCount / totalSections) * 100);
    
    document.getElementById('progress-fill').style.width = `${percentage}%`;
    document.getElementById('progress-text').textContent = 
        `Progress: ${percentage}% (${completedCount}/${totalSections} sections completed)`;
}

// Utility: Shuffle array
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
