/**
 * Presentation Generator Module
 * Generates PPT-ready JSON structure for lesson slides, revision slides, and topic presentations
 */

class PresentationGenerator {
    constructor() {
        this.aiIntegration = null;
    }

    /**
     * Set AI integration instance
     */
    setAIIntegration(aiIntegration) {
        this.aiIntegration = aiIntegration;
    }

    /**
     * Generate presentation based on type
     */
    async generatePresentation(content, type, slideCount, includeNotes, language = 'english') {
        const presentation = {
            metadata: {
                type: type,
                slideCount: slideCount,
                includeNotes: includeNotes,
                language: language,
                generatedAt: new Date().toISOString(),
                source: 'PDF content'
            },
            slides: []
        };

        switch(type) {
            case 'lesson':
                presentation.slides = await this.generateLessonSlides(content, slideCount, includeNotes, language);
                break;
            case 'revision':
                presentation.slides = await this.generateRevisionSlides(content, slideCount, includeNotes, language);
                break;
            case 'topic':
                presentation.slides = await this.generateTopicSlides(content, slideCount, includeNotes, language);
                break;
            default:
                presentation.slides = await this.generateLessonSlides(content, slideCount, includeNotes, language);
        }

        return presentation;
    }

    /**
     * Generate lesson slides
     */
    async generateLessonSlides(content, slideCount, includeNotes, language) {
        const slides = [];
        
        // Title slide
        slides.push({
            id: 1,
            type: 'title',
            title: 'Lesson Presentation',
            subtitle: 'Based on Study Materials',
            content: [],
            notes: includeNotes ? 'Welcome to the lesson. Introduce the topic and set learning objectives.' : null
        });

        // Content slides
        const topics = this.extractTopics(content);
        const topicCount = Math.min(topics.length, slideCount - 2); // Reserve space for title and conclusion

        for (let i = 0; i < topicCount; i++) {
            const topic = topics[i];
            const slide = {
                id: i + 2,
                type: 'content',
                title: topic.title || `Topic ${i + 1}`,
                content: topic.points || this.extractBulletPoints(content, topic),
                notes: includeNotes ? await this.generateSpeakerNotes(topic, 'lesson', language) : null
            };
            slides.push(slide);
        }

        // Fill remaining slides if needed
        while (slides.length < slideCount - 1) {
            slides.push({
                id: slides.length + 1,
                type: 'content',
                title: `Additional Topic ${slides.length - 1}`,
                content: this.extractBulletPoints(content),
                notes: includeNotes ? 'Continue with additional content from the study materials.' : null
            });
        }

        // Conclusion slide
        slides.push({
            id: slideCount,
            type: 'conclusion',
            title: 'Summary & Conclusion',
            subtitle: 'Key Takeaways',
            content: this.extractKeyPoints(content),
            notes: includeNotes ? 'Summarize the lesson and open for questions.' : null
        });

        return slides;
    }

    /**
     * Generate revision slides
     */
    async generateRevisionSlides(content, slideCount, includeNotes, language) {
        const slides = [];
        
        // Title slide
        slides.push({
            id: 1,
            type: 'title',
            title: 'Revision Slides',
            subtitle: 'Quick Review',
            content: [],
            notes: includeNotes ? 'Welcome to the revision session. Focus on key concepts and formulas.' : null
        });

        // Key points slides
        const keyPoints = this.extractKeyPoints(content);
        const pointsPerSlide = Math.ceil(keyPoints.length / (slideCount - 2));

        for (let i = 0; i < slideCount - 2; i++) {
            const start = i * pointsPerSlide;
            const end = start + pointsPerSlide;
            const slidePoints = keyPoints.slice(start, end);

            slides.push({
                id: i + 2,
                type: 'revision',
                title: `Key Points ${i + 1}`,
                content: slidePoints,
                notes: includeNotes ? await this.generateSpeakerNotes({ points: slidePoints }, 'revision', language) : null
            });
        }

        // Conclusion slide
        slides.push({
            id: slideCount,
            type: 'conclusion',
            title: 'Final Review',
            subtitle: 'Before the Exam',
            content: [
                'Review all formulas and definitions',
                'Practice with past papers',
                'Focus on weak areas',
                'Get enough rest before exam'
            ],
            notes: includeNotes ? 'Final tips for exam preparation. Good luck!' : null
        });

        return slides;
    }

    /**
     * Generate topic slides
     */
    async generateTopicSlides(content, slideCount, includeNotes, language) {
        const slides = [];
        
        // Title slide
        slides.push({
            id: 1,
            type: 'title',
            title: 'Topic Overview',
            subtitle: 'Deep Dive',
            content: [],
            notes: includeNotes ? 'Introduction to the topic overview presentation.' : null
        });

        // Extract main topic
        const mainTopic = this.extractMainTopic(content);

        // Overview slide
        slides.push({
            id: 2,
            type: 'overview',
            title: 'Topic Overview',
            content: [
                `Topic: ${mainTopic}`,
                'Definition and scope',
                'Importance and applications',
                'Learning objectives'
            ],
            notes: includeNotes ? await this.generateSpeakerNotes({ topic: mainTopic }, 'topic', language) : null
        });

        // Content slides
        const subtopics = this.extractSubtopics(content);
        const subtopicCount = Math.min(subtopics.length, slideCount - 3);

        for (let i = 0; i < subtopicCount; i++) {
            slides.push({
                id: i + 3,
                type: 'content',
                title: subtopics[i].title || `Subtopic ${i + 1}`,
                content: subtopics[i].points || this.extractBulletPoints(content, subtopics[i]),
                notes: includeNotes ? await this.generateSpeakerNotes(subtopics[i], 'topic', language) : null
            });
        }

        // Fill remaining slides if needed
        while (slides.length < slideCount - 1) {
            slides.push({
                id: slides.length + 1,
                type: 'content',
                title: `Detail ${slides.length - 1}`,
                content: this.extractBulletPoints(content),
                notes: includeNotes ? 'Continue with additional details.' : null
            });
        }

        // Conclusion slide
        slides.push({
            id: slideCount,
            type: 'conclusion',
            title: 'Summary',
            subtitle: 'Topic Recap',
            content: [
                'Main concepts covered',
                'Key takeaways',
                'Further reading',
                'Practice exercises'
            ],
            notes: includeNotes ? 'Summary of the topic presentation.' : null
        });

        return slides;
    }

    /**
     * Extract topics from content
     */
    extractTopics(content) {
        const topics = [];
        const lines = content.split('\n');
        
        // Look for heading patterns
        const headingPatterns = [
            /^[A-Z][A-Z\s]{5,50}$/,
            /^#{2,3}\s+(.+)$/,
            /^\d+\.\s+(.+)$/
        ];

        lines.forEach(line => {
            headingPatterns.forEach(pattern => {
                const match = line.match(pattern);
                if (match) {
                    const title = match[1] || match[0].trim();
                    if (title.length > 5 && title.length < 50) {
                        topics.push({
                            title: title,
                            points: []
                        });
                    }
                }
            });
        });

        // If no topics found, create generic ones
        if (topics.length === 0) {
            for (let i = 1; i <= 8; i++) {
                topics.push({
                    title: `Topic ${i}`,
                    points: []
                });
            }
        }

        return topics.slice(0, 10);
    }

    /**
     * Extract bullet points from content
     */
    extractBulletPoints(content, topic = null) {
        const points = [];
        const lines = content.split('\n');
        
        const bulletPatterns = [
            /^-\s+(.+)$/,
            /^\*\s+(.+)$/,
            /^•\s+(.+)$/,
            /^\d+\.\s+(.+)$/
        ];

        lines.forEach(line => {
            bulletPatterns.forEach(pattern => {
                const match = line.match(pattern);
                if (match && match[1].length > 5 && match[1].length < 100) {
                    points.push(match[1].trim());
                }
            });
        });

        // If no bullet points found, create generic ones
        if (points.length === 0) {
            const sentences = content.split(/[.!?]+/);
            sentences.forEach(sentence => {
                if (sentence.trim().length > 10 && sentence.trim().length < 80) {
                    points.push(sentence.trim());
                }
            });
        }

        return points.slice(0, 5); // Limit to 5 points per slide
    }

    /**
     * Extract key points from content
     */
    extractKeyPoints(content) {
        const keyPoints = [];
        const lines = content.split('\n');
        
        // Look for key point patterns
        const keyPatterns = [
            /(?:key|important|essential|fundamental|critical)\s+(?:point|concept|idea)/gi,
            /(?:remember|note|recall)/gi
        ];

        lines.forEach(line => {
            keyPatterns.forEach(pattern => {
                if (pattern.test(line) && line.length > 10 && line.length < 100) {
                    keyPoints.push(line.trim());
                }
            });
        });

        // If no key points found, extract from headings
        if (keyPoints.length === 0) {
            const headings = content.match(/^[A-Z][A-Z\s]{5,50}$/gm) || [];
            headings.forEach(heading => {
                keyPoints.push(heading.trim());
            });
        }

        // Still no points, create generic ones
        if (keyPoints.length === 0) {
            for (let i = 1; i <= 10; i++) {
                keyPoints.push(`Key Point ${i}: Important concept from the study materials`);
            }
        }

        return keyPoints.slice(0, 12);
    }

    /**
     * Extract main topic from content
     */
    extractMainTopic(content) {
        // Look for the first significant heading
        const lines = content.split('\n');
        
        for (const line of lines) {
            if (line.length > 10 && line.length < 50 && /^[A-Z]/.test(line)) {
                return line.trim();
            }
        }

        return 'Study Topic';
    }

    /**
     * Extract subtopics from content
     */
    extractSubtopics(content) {
        const subtopics = [];
        const lines = content.split('\n');
        
        // Look for section patterns
        const sectionPatterns = [
            /^#{2}\s+(.+)$/,
            /^[A-Z][A-Z\s]{5,30}$/,
            /^\d+\.\d+\s+(.+)$/
        ];

        lines.forEach(line => {
            sectionPatterns.forEach(pattern => {
                const match = line.match(pattern);
                if (match) {
                    const title = match[1] || match[0].trim();
                    if (title.length > 5 && title.length < 40) {
                        subtopics.push({
                            title: title,
                            points: []
                        });
                    }
                }
            });
        });

        // If no subtopics found, create generic ones
        if (subtopics.length === 0) {
            for (let i = 1; i <= 6; i++) {
                subtopics.push({
                    title: `Subtopic ${i}`,
                    points: []
                });
            }
        }

        return subtopics.slice(0, 8);
    }

    /**
     * Generate speaker notes using AI
     */
    async generateSpeakerNotes(topic, presentationType, language) {
        if (!this.aiIntegration) {
            return this.generatePlaceholderNotes(topic, presentationType);
        }

        const prompt = this.buildSpeakerNotesPrompt(topic, presentationType, language);

        try {
            const notes = await this.aiIntegration.generateContent(prompt, {
                type: 'notes',
                context: topic.content || topic.points?.join('\n') || '',
                language: language,
                temperature: 0.7,
                maxTokens: 500
            });
            return notes;
        } catch (error) {
            console.error('Error generating speaker notes:', error);
            return this.generatePlaceholderNotes(topic, presentationType);
        }
    }

    /**
     * Build prompt for speaker notes
     */
    buildSpeakerNotesPrompt(topic, presentationType, language) {
        const typeInstructions = {
            lesson: 'Generate speaker notes for a lesson slide. Include explanations, examples, and discussion points.',
            revision: 'Generate speaker notes for a revision slide. Focus on quick review, key formulas, and exam tips.',
            topic: 'Generate speaker notes for a topic overview slide. Include definitions, importance, and applications.'
        };

        return `${typeInstructions[presentationType] || typeInstructions.lesson}

Topic: ${topic.title || 'Content'}
Content: ${topic.points?.join('\n') || topic.content || ''}

Generate concise speaker notes (2-3 sentences) that the presenter can use during the presentation.`;
    }

    /**
     * Generate placeholder speaker notes
     */
    generatePlaceholderNotes(topic, presentationType) {
        const typeNotes = {
            lesson: `Explain the key concepts of ${topic.title || 'this topic'}. Provide examples and ask students if they have questions.`,
            revision: `Quick review of ${topic.title || 'this topic'}. Emphasize important points and common exam questions.`,
            topic: `Overview of ${topic.title || 'this topic'}. Explain its importance and how it connects to other topics.`
        };

        return typeNotes[presentationType] || typeNotes.lesson;
    }

    /**
     * Convert presentation to PPT-ready JSON
     */
    toPPTXJSON(presentation) {
        return {
            version: '1.0',
            format: 'pptx',
            metadata: presentation.metadata,
            slides: presentation.slides.map(slide => ({
                slideNumber: slide.id,
                slideType: slide.type,
                title: slide.title,
                subtitle: slide.subtitle || '',
                content: slide.content || [],
                speakerNotes: slide.notes || '',
                layout: this.getSlideLayout(slide.type)
            }))
        };
    }

    /**
     * Get slide layout based on type
     */
    getSlideLayout(type) {
        const layouts = {
            'title': 'Title Slide',
            'content': 'Title and Content',
            'overview': 'Title and Content',
            'revision': 'Two Content',
            'conclusion': 'Title and Content'
        };
        return layouts[type] || 'Title and Content';
    }

    /**
     * Export presentation as JSON
     */
    exportAsJSON(presentation) {
        return JSON.stringify(presentation, null, 2);
    }

    /**
     * Prepare for PPTX export
     */
    prepareForPPTX(presentation) {
        // This would integrate with a library like PptxGenJS
        // For now, return the PPT-ready JSON structure
        return {
            success: true,
            format: 'pptx',
            data: this.toPPTXJSON(presentation),
            message: 'PPTX export requires PptxGenJS library integration'
        };
    }

    /**
     * Prepare for PDF export
     */
    prepareForPDF(presentation) {
        // This would integrate with a library like jsPDF
        // For now, return the presentation structure
        return {
            success: true,
            format: 'pdf',
            data: presentation,
            message: 'PDF export requires jsPDF library integration'
        };
    }

    /**
     * Render presentation to HTML preview
     */
    renderToHTML(presentation) {
        let html = '<div class="presentation-preview">';

        presentation.slides.forEach(slide => {
            html += `
                <div class="slide-preview" data-slide-id="${slide.id}">
                    <div class="slide-number">Slide ${slide.id}</div>
                    <h2 class="slide-title">${slide.title}</h2>
                    ${slide.subtitle ? `<p class="slide-subtitle">${slide.subtitle}</p>` : ''}
                    <div class="slide-content">
                        <ul>
                            ${slide.content.map(point => `<li>${point}</li>`).join('')}
                        </ul>
                    </div>
                    ${slide.notes ? `
                        <div class="slide-notes">
                            <h5>Speaker Notes</h5>
                            <p>${slide.notes}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        html += '</div>';
        return html;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PresentationGenerator;
}

// Create global instance
const presentationGenerator = new PresentationGenerator();
