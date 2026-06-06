/**
 * AI API Integration Module
 * Supports Gemini API and OpenRouter API for content generation
 */

class AIIntegration {
    constructor() {
        this.apiProvider = 'auto'; // 'gemini', 'openrouter', or 'auto'
        this.apiKeys = {
            gemini: null,
            openrouter: null
        };
        this.endpoints = {
            gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
            openrouter: 'https://openrouter.ai/api/v1/chat/completions',
            worker: '/worker.js' // Cloudflare Worker endpoint
        };
    }

    /**
     * Set API keys
     */
    setAPIKey(provider, key) {
        this.apiKeys[provider] = key;
    }

    /**
     * Set API provider
     */
    setProvider(provider) {
        this.apiProvider = provider;
    }

    /**
     * Generate content using AI
     */
    async generateContent(prompt, options = {}) {
        const {
            type = 'notes',
            context = '',
            language = 'english',
            temperature = 0.7,
            maxTokens = 8192
        } = options;

        // Build the full prompt with context and language instructions
        const fullPrompt = this.buildPrompt(prompt, context, language, type);

        // Try to use available API
        if (this.apiProvider === 'auto') {
            // Try Gemini first, then OpenRouter
            if (this.apiKeys.gemini) {
                try {
                    return await this.callGemini(fullPrompt, temperature, maxTokens);
                } catch (error) {
                    console.error('Gemini API failed:', error);
                }
            }
            if (this.apiKeys.openrouter) {
                try {
                    return await this.callOpenRouter(fullPrompt, temperature, maxTokens);
                } catch (error) {
                    console.error('OpenRouter API failed:', error);
                }
            }
            // Fall back to worker
            return await this.callWorker(fullPrompt, type, language);
        }

        if (this.apiProvider === 'gemini' && this.apiKeys.gemini) {
            return await this.callGemini(fullPrompt, temperature, maxTokens);
        }

        if (this.apiProvider === 'openrouter' && this.apiKeys.openrouter) {
            return await this.callOpenRouter(fullPrompt, temperature, maxTokens);
        }

        // Fall back to worker
        return await this.callWorker(fullPrompt, type, language);
    }

    /**
     * Build prompt with context and language instructions
     */
    buildPrompt(basePrompt, context, language, type) {
        const languageInstructions = {
            english: 'Respond in standard English with academic vocabulary appropriate for the subject matter.',
            simpleEnglish: 'Respond in simple English with basic vocabulary. Avoid complex sentence structures and technical jargon unless absolutely necessary.',
            romanUrdu: 'Respond in Roman Urdu (Urdu written in English script). Make it easy to understand for Urdu speakers while maintaining educational accuracy.'
        };

        const systemPrompt = `You are an expert educational AI assistant for StudyForge AI. Your role is to help students learn by generating high-quality educational content based on the provided study materials.

IMPORTANT INSTRUCTIONS:
1. Base your response ONLY on the provided context from the study materials.
2. Do not hallucinate or add information not present in the source material.
3. If the context doesn't contain sufficient information to answer, state this clearly.
4. ${languageInstructions[language] || languageInstructions.english}
5. Format your response clearly with appropriate headings, bullet points, and structure.
6. Focus on accuracy, clarity, and educational value.`;

        return `${systemPrompt}

STUDY MATERIAL CONTEXT:
${context}

TASK:
${basePrompt}`;
    }

    /**
     * Call Gemini API
     */
    async callGemini(prompt, temperature, maxTokens) {
        const model = 'gemini-1.5-pro';
        const url = `${this.endpoints.gemini}/${model}:generateContent?key=${this.apiKeys.gemini}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: temperature,
                    maxOutputTokens: maxTokens
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    /**
     * Call OpenRouter API
     */
    async callOpenRouter(prompt, temperature, maxTokens) {
        const model = 'anthropic/claude-3.5-sonnet';
        const url = this.endpoints.openrouter;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKeys.openrouter}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'StudyForge AI'
            },
            body: JSON.stringify({
                model: model,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                temperature: temperature,
                max_tokens: maxTokens
            })
        });

        if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    /**
     * Call Cloudflare Worker (fallback)
     */
    async callWorker(prompt, type, language) {
        const url = this.endpoints.worker;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                type: type,
                language: language
            })
        });

        if (!response.ok) {
            throw new Error(`Worker error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.content || data.text || data.response;
    }

    /**
     * Retrieve relevant chunks for context
     */
    retrieveRelevantChunks(query, chunks, topK = 5) {
        // Simple keyword-based retrieval (can be enhanced with embeddings later)
        const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        
        const scoredChunks = chunks.map(chunk => {
            const chunkText = chunk.text.toLowerCase();
            let score = 0;
            
            queryWords.forEach(word => {
                const regex = new RegExp(word, 'gi');
                const matches = chunkText.match(regex);
                if (matches) {
                    score += matches.length;
                }
            });
            
            return {
                ...chunk,
                score: score
            };
        });

        // Sort by score and return top K
        return scoredChunks
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(chunk => chunk.text);
    }

    /**
     * Build context from chunks
     */
    buildContextFromChunks(chunks) {
        if (!chunks || chunks.length === 0) {
            return '';
        }
        return chunks.join('\n\n---\n\n');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIIntegration;
}

// Create global instance
const aiIntegration = new AIIntegration();
