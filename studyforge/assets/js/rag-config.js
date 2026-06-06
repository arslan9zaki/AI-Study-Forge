/**
 * RAG-Ready Architecture Configuration
 * Designed for Gemini API and OpenRouter API integration
 */

const RAG_CONFIG = {
    // API Configuration
    api: {
        provider: 'auto', // 'gemini', 'openrouter', or 'auto'
        gemini: {
            endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
            model: 'gemini-1.5-pro',
            maxTokens: 8192,
            temperature: 0.7
        },
        openrouter: {
            endpoint: 'https://openrouter.ai/api/v1/chat/completions',
            model: 'anthropic/claude-3.5-sonnet',
            maxTokens: 8192,
            temperature: 0.7
        }
    },

    // Chunking Strategy
    chunking: {
        method: 'semantic', // 'fixed', 'semantic', or 'hybrid'
        fixed: {
            maxSize: 1000,
            overlap: 100
        },
        semantic: {
            minSize: 500,
            maxSize: 1500,
            overlap: 200,
            splitOn: ['\n\n', '\n', '.', '!', '?']
        },
        hybrid: {
            semanticFirst: true,
            fallbackToFixed: true
        }
    },

    // Retrieval Configuration
    retrieval: {
        method: 'similarity', // 'similarity', 'hybrid', or 'mmr'
        topK: 5,
        scoreThreshold: 0.7,
        rerank: true,
        maxResults: 10
    },

    // Context Injection
    context: {
        maxContextTokens: 4096,
        systemPrompt: `You are an expert educational AI assistant for StudyForge AI. 
Your role is to help students learn by generating high-quality educational content.
Always provide accurate, well-structured, and easy-to-understand explanations.
Adapt your language level based on the user's preference (English, Simple English, or Roman Urdu).
Focus on clarity, accuracy, and educational value.`,
        includeMetadata: true,
        includeSource: true
    },

    // Learning Action Prompts
    prompts: {
        notes: `Generate comprehensive study notes from the provided content.
Include:
- Key concepts and definitions
- Important formulas or equations (if applicable)
- Examples and explanations
- Summary points
Format with clear headings and bullet points.`,

        mcq: `Generate multiple choice questions from the provided content.
For each question provide:
- The question
- 4 options (A, B, C, D)
- Correct answer
- Brief explanation
Generate 10-15 questions covering different difficulty levels.`,

        flashcards: `Generate flashcards from the provided content.
Each flashcard should have:
- Front: Key term, concept, or question
- Back: Definition, explanation, or answer
Keep answers concise and memorable.
Generate 15-20 flashcards.`,

        quiz: `Generate a comprehensive quiz from the provided content.
Include:
- Mix of question types (multiple choice, true/false, short answer)
- Questions of varying difficulty
- Answer key with explanations
- Scoring guidelines
Generate a 20-question quiz.`,

        shortQuestions: `Generate short answer questions from the provided content.
Each question should:
- Be answerable in 1-3 sentences
- Test understanding of key concepts
- Include model answers
Generate 15-20 questions.`,

        longQuestions: `Generate essay-type questions from the provided content.
Each question should:
- Require detailed explanation
- Test critical thinking and application
- Include marking scheme/guidelines
Generate 5-8 questions.`,

        revision: `Generate revision notes from the provided content.
Focus on:
- Key points to remember
- Important formulas/equations
- Common mistakes to avoid
- Quick reference summary
Format for last-minute revision.`,

        visual: `Generate descriptions for visual learning aids from the provided content.
Include descriptions for:
- Diagrams (with labels and annotations)
- Flowcharts (showing processes or relationships)
- Concept maps (connecting related ideas)
- Tables (comparing concepts)
- Graphs (showing trends or relationships)
Provide detailed descriptions that can be used to create these visuals.`,

        presentation: `Generate presentation slides from the provided content.
Structure:
- Title slide
- 8-12 content slides
- Each slide with:
  - Title
  - 3-5 bullet points
  - Speaker notes
- Conclusion slide
Format for educational presentation.`,

        ask: `You are in Q&A mode. Answer the user's question based on the provided context.
If the answer is not in the context, say so clearly.
Provide clear, accurate, and educational responses.`
    },

    // Language Configuration
    languages: {
        ui: {
            english: 'English',
            urdu: 'اردو'
        },
        output: {
            english: 'English - Standard academic language',
            simpleEnglish: 'Simple English - Easy to understand, basic vocabulary',
            romanUrdu: 'Roman Urdu - Urdu written in English script'
        }
    },

    // Visual Learning Generation
    visual: {
        supportedTypes: ['diagram', 'flowchart', 'concept-map', 'graph', 'chart', 'table'],
        formats: {
            diagram: 'SVG description with labels and annotations',
            flowchart: 'Mermaid-compatible flowchart syntax',
            conceptMap: 'Mind map structure with connections',
            graph: 'Chart.js or Plotly configuration',
            chart: 'Table or chart data structure',
            table: 'Markdown table format'
        }
    },

    // Presentation Generation
    presentation: {
        formats: ['markdown', 'html', 'json'],
        exportSupport: {
            pptx: 'planned',
            pdf: 'planned'
        },
        slideStructure: {
            title: 'Title and subtitle',
            content: '3-5 bullet points per slide',
            notes: 'Speaker notes for presenter',
            visual: 'Suggested visual aids'
        }
    },

    // Storage Configuration
    storage: {
        type: 'localStorage', // 'localStorage' or 'indexedDB'
        keys: {
            studyHistory: 'studyforge_history',
            savedNotes: 'studyforge_notes',
            savedFlashcards: 'studyforge_flashcards',
            quizHistory: 'studyforge_quizzes',
            progress: 'studyforge_progress',
            settings: 'studyforge_settings'
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RAG_CONFIG;
}
