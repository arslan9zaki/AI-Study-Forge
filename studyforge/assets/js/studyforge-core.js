/**
 * StudyForge AI Core JavaScript Module
 * Handles RAG operations, content generation, and data management
 */

class StudyForgeAI {
    constructor() {
        this.config = RAG_CONFIG;
        this.storage = new StudyForgeStorage();
        this.chunker = new TextChunker(this.config.chunking);
        this.retriever = new ContentRetriever(this.config.retrieval);
        this.generator = new ContentGenerator(this.config.prompts, this.config.api);
        this.aiIntegration = new AIIntegration();
    }

    /**
     * Process uploaded PDF
     * Workflow: Upload → Extract Text → Detect Chapters → Detect Topics
     */
    async processPDF(file) {
        try {
            // Step 1: Extract text from PDF
            const text = await this.extractTextFromPDF(file);
            
            // Step 2: Detect chapters
            const chapters = this.detectChapters(text);
            
            // Step 3: Detect topics within chapters
            const topics = this.detectTopics(text, chapters);
            
            // Step 4: Create chunks for RAG
            const chunks = this.chunker.chunk(text);
            
            // Store processed data
            const processedData = {
                fileName: file.name,
                fileSize: file.size,
                text: text,
                chapters: chapters,
                topics: topics,
                chunks: chunks,
                processedAt: new Date().toISOString()
            };
            
            await this.storage.saveStudyHistory(processedData);
            
            return processedData;
        } catch (error) {
            console.error('Error processing PDF:', error);
            throw error;
        }
    }

    /**
     * Extract text from PDF file
     * Note: This is a placeholder - actual implementation would use PDF.js or similar library
     */
    async extractTextFromPDF(file) {
        // Placeholder implementation
        // In production, this would use PDF.js or a server-side PDF parser
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve("Sample extracted text from PDF. In production, this would contain the actual text content from the uploaded PDF file.");
            }, 1000);
        });
    }

    /**
     * Detect chapters in the text
     */
    detectChapters(text) {
        const chapterPatterns = [
            /Chapter\s+\d+/gi,
            /Chapter\s+[IVX]+/gi,
            /\d+\.\s+/g,
            /Unit\s+\d+/gi
        ];
        
        const chapters = [];
        const lines = text.split('\n');
        
        lines.forEach((line, index) => {
            chapterPatterns.forEach(pattern => {
                if (pattern.test(line)) {
                    chapters.push({
                        title: line.trim(),
                        startIndex: index,
                        content: ''
                    });
                }
            });
        });
        
        return chapters;
    }

    /**
     * Detect topics within the text
     */
    detectTopics(text, chapters) {
        const topicKeywords = [
            'introduction', 'definition', 'overview', 'concept',
            'principle', 'theory', 'application', 'example',
            'summary', 'conclusion', 'key points', 'important'
        ];
        
        const topics = [];
        const sentences = text.split(/[.!?]+/);
        
        sentences.forEach(sentence => {
            const lowerSentence = sentence.toLowerCase();
            topicKeywords.forEach(keyword => {
                if (lowerSentence.includes(keyword)) {
                    topics.push({
                        title: sentence.trim().substring(0, 50) + '...',
                        keyword: keyword,
                        context: sentence.trim()
                    });
                }
            });
        });
        
        return topics.slice(0, 10); // Limit to top 10 topics
    }

    /**
     * Generate learning content based on action type with AI
     */
    async generateContent(actionType, context, language = 'english', chunks = []) {
        try {
            // Retrieve relevant chunks for RAG context
            let ragContext = context;
            if (chunks && chunks.length > 0) {
                const relevantChunks = this.aiIntegration.retrieveRelevantChunks(
                    this.config.prompts[actionType] || this.config.prompts.notes,
                    chunks,
                    5
                );
                ragContext = this.aiIntegration.buildContextFromChunks(relevantChunks);
            }

            // Generate content using AI
            const content = await this.aiIntegration.generateContent(
                this.config.prompts[actionType] || this.config.prompts.notes,
                {
                    type: actionType,
                    context: ragContext,
                    language: language,
                    temperature: 0.7,
                    maxTokens: 8192
                }
            );
            
            return content;
        } catch (error) {
            console.error('Error generating content:', error);
            throw error;
        }
    }

    /**
     * Build prompt for content generation
     */
    buildPrompt(actionType, context, language) {
        const basePrompt = this.config.prompts[actionType] || this.config.prompts.notes;
        const languageInstruction = this.getLanguageInstruction(language);
        
        return `${this.config.context.systemPrompt}

${languageInstruction}

${basePrompt}

Context:
${context}`;
    }

    /**
     * Get language instruction based on selected language
     */
    getLanguageInstruction(language) {
        const instructions = {
            english: 'Respond in standard English with academic vocabulary.',
            simpleEnglish: 'Respond in simple English with basic vocabulary. Avoid complex sentence structures.',
            romanUrdu: 'Respond in Roman Urdu (Urdu written in English script). Make it easy to understand for Urdu speakers.'
        };
        return instructions[language] || instructions.english;
    }

    /**
     * RAG: Retrieve relevant chunks for context
     */
    async retrieveContext(query, chunks) {
        return this.retriever.retrieve(query, chunks);
    }

    /**
     * Save generated content
     */
    async saveContent(type, content, metadata = {}) {
        const savedItem = {
            id: Date.now(),
            type: type,
            content: content,
            metadata: metadata,
            createdAt: new Date().toISOString()
        };
        
        switch(type) {
            case 'notes':
                await this.storage.saveNote(savedItem);
                break;
            case 'flashcards':
                await this.storage.saveFlashcard(savedItem);
                break;
            default:
                await this.storage.saveStudyHistory(savedItem);
        }
        
        return savedItem;
    }

    /**
     * Get user's study history
     */
    async getStudyHistory() {
        return await this.storage.getStudyHistory();
    }

    /**
     * Get saved notes
     */
    async getSavedNotes() {
        return await this.storage.getSavedNotes();
    }

    /**
     * Get saved flashcards
     */
    async getSavedFlashcards() {
        return await this.storage.getSavedFlashcards();
    }

    /**
     * Get quiz history
     */
    async getQuizHistory() {
        return await this.storage.getQuizHistory();
    }

    /**
     * Get progress data
     */
    async getProgress() {
        return await this.storage.getProgress();
    }
}

/**
 * Text Chunker for RAG
 */
class TextChunker {
    constructor(config) {
        this.config = config;
    }

    chunk(text) {
        switch(this.config.method) {
            case 'fixed':
                return this.fixedChunk(text);
            case 'semantic':
                return this.semanticChunk(text);
            case 'hybrid':
                return this.hybridChunk(text);
            default:
                return this.semanticChunk(text);
        }
    }

    fixedChunk(text) {
        const chunks = [];
        const size = this.config.fixed.maxSize;
        const overlap = this.config.fixed.overlap;
        
        for (let i = 0; i < text.length; i += size - overlap) {
            chunks.push({
                id: chunks.length,
                text: text.substring(i, i + size),
                metadata: {
                    method: 'fixed',
                    startIndex: i,
                    endIndex: i + size
                }
            });
        }
        
        return chunks;
    }

    semanticChunk(text) {
        const chunks = [];
        const splitPoints = this.config.semantic.splitOn;
        
        let currentChunk = '';
        let chunkIndex = 0;
        
        // Split by semantic boundaries
        const segments = text.split(new RegExp(splitPoints.join('|'), 'g'));
        
        segments.forEach(segment => {
            if (currentChunk.length + segment.length > this.config.semantic.maxSize) {
                if (currentChunk) {
                    chunks.push({
                        id: chunkIndex++,
                        text: currentChunk.trim(),
                        metadata: {
                            method: 'semantic',
                            size: currentChunk.length
                        }
                    });
                }
                currentChunk = segment;
            } else {
                currentChunk += segment;
            }
        });
        
        if (currentChunk) {
            chunks.push({
                id: chunkIndex,
                text: currentChunk.trim(),
                metadata: {
                    method: 'semantic',
                    size: currentChunk.length
                }
            });
        }
        
        return chunks;
    }

    hybridChunk(text) {
        try {
            return this.semanticChunk(text);
        } catch (e) {
            return this.fixedChunk(text);
        }
    }
}

/**
 * Content Retriever for RAG
 */
class ContentRetriever {
    constructor(config) {
        this.config = config;
    }

    retrieve(query, chunks) {
        // Placeholder for semantic search
        // In production, this would use embeddings and vector similarity search
        const scoredChunks = chunks.map(chunk => ({
            ...chunk,
            score: this.calculateSimilarity(query, chunk.text)
        }));
        
        // Sort by score and filter
        const filtered = scoredChunks
            .filter(chunk => chunk.score >= this.config.scoreThreshold)
            .sort((a, b) => b.score - a.score)
            .slice(0, this.config.topK);
        
        return filtered;
    }

    calculateSimilarity(query, text) {
        // Placeholder for similarity calculation
        // In production, this would use cosine similarity of embeddings
        const queryWords = query.toLowerCase().split(' ');
        const textWords = text.toLowerCase().split(' ');
        
        const matches = queryWords.filter(word => textWords.includes(word));
        return matches.length / queryWords.length;
    }
}

/**
 * Content Generator using AI APIs
 */
class ContentGenerator {
    constructor(prompts, apiConfig) {
        this.prompts = prompts;
        this.apiConfig = apiConfig;
    }

    async generate(prompt) {
        // Placeholder for AI API integration
        // In production, this would call Gemini or OpenRouter APIs
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve("Generated content will appear here after AI API integration. This is a placeholder response.");
            }, 1500);
        });
    }
}

/**
 * Storage Manager for StudyForge data
 */
class StudyForgeStorage {
    constructor() {
        this.storageType = RAG_CONFIG.storage.type;
        this.keys = RAG_CONFIG.storage.keys;
    }

    async saveStudyHistory(data) {
        const history = await this.getStudyHistory();
        history.push(data);
        localStorage.setItem(this.keys.studyHistory, JSON.stringify(history));
    }

    async getStudyHistory() {
        const data = localStorage.getItem(this.keys.studyHistory);
        return data ? JSON.parse(data) : [];
    }

    async saveNote(note) {
        const notes = await this.getSavedNotes();
        notes.push(note);
        localStorage.setItem(this.keys.savedNotes, JSON.stringify(notes));
    }

    async getSavedNotes() {
        const data = localStorage.getItem(this.keys.savedNotes);
        return data ? JSON.parse(data) : [];
    }

    async saveFlashcard(flashcard) {
        const flashcards = await this.getSavedFlashcards();
        flashcards.push(flashcard);
        localStorage.setItem(this.keys.savedFlashcards, JSON.stringify(flashcards));
    }

    async getSavedFlashcards() {
        const data = localStorage.getItem(this.keys.savedFlashcards);
        return data ? JSON.parse(data) : [];
    }

    async saveQuizResult(quiz) {
        const quizzes = await this.getQuizHistory();
        quizzes.push(quiz);
        localStorage.setItem(this.keys.quizHistory, JSON.stringify(quizzes));
    }

    async getQuizHistory() {
        const data = localStorage.getItem(this.keys.quizHistory);
        return data ? JSON.parse(data) : [];
    }

    async saveProgress(progress) {
        localStorage.setItem(this.keys.progress, JSON.stringify(progress));
    }

    async getProgress() {
        const data = localStorage.getItem(this.keys.progress);
        return data ? JSON.parse(data) : {};
    }

    async saveSettings(settings) {
        localStorage.setItem(this.keys.settings, JSON.stringify(settings));
    }

    async getSettings() {
        const data = localStorage.getItem(this.keys.settings);
        return data ? JSON.parse(data) : {};
    }

    async clearAllData() {
        Object.values(this.keys).forEach(key => {
            localStorage.removeItem(key);
        });
    }
}

// Initialize global instance
const studyForge = new StudyForgeAI();
