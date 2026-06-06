/**
 * Visual Learning Engine
 * Generates diagrams, flowcharts, concept maps, graphs, and tables from educational content
 */

class VisualLearningEngine {
    constructor() {
        this.visualTypes = ['diagram', 'flowchart', 'concept-map', 'graph', 'table'];
    }

    /**
     * Generate visual from content based on type
     */
    async generateVisual(content, type, topics = []) {
        switch(type) {
            case 'diagram':
                return this.generateDiagram(content);
            case 'flowchart':
                return this.generateFlowchart(content);
            case 'concept-map':
                return this.generateConceptMap(topics);
            case 'graph':
                return this.generateGraph(content);
            case 'table':
                return this.generateTable(content);
            default:
                return this.generateDiagram(content);
        }
    }

    /**
     * Generate diagram from content
     */
    generateDiagram(content) {
        // Extract key concepts and relationships
        const concepts = this.extractConcepts(content);
        
        if (concepts.length === 0) {
            return this.generatePlaceholderDiagram();
        }

        // Build Mermaid diagram syntax
        let mermaidCode = 'graph TD\n';
        
        concepts.forEach((concept, index) => {
            const nodeId = `C${index}`;
            mermaidCode += `    ${nodeId}["${concept.name}"]\n`;
            
            if (concept.relationships && concept.relationships.length > 0) {
                concept.relationships.forEach((rel, relIndex) => {
                    const targetId = `C${relIndex}`;
                    mermaidCode += `    ${nodeId} -->|${rel.label}| ${targetId}\n`;
                });
            }
        });

        return {
            type: 'diagram',
            mermaidCode: mermaidCode,
            description: 'Diagram showing key concepts and their relationships'
        };
    }

    /**
     * Generate flowchart from content
     */
    generateFlowchart(content) {
        // Extract process steps
        const steps = this.extractProcessSteps(content);
        
        if (steps.length === 0) {
            return this.generatePlaceholderFlowchart();
        }

        // Build Mermaid flowchart syntax
        let mermaidCode = 'graph LR\n';
        
        steps.forEach((step, index) => {
            const nodeId = `S${index}`;
            const shape = step.type === 'decision' ? '{' : '[';
            const endShape = step.type === 'decision' ? '}' : ']';
            
            mermaidCode += `    ${nodeId}${shape}"${step.label}"${endShape}\n`;
            
            if (index < steps.length - 1) {
                const nextNodeId = `S${index + 1}`;
                mermaidCode += `    ${nodeId} --> ${nextNodeId}\n`;
            }
        });

        return {
            type: 'flowchart',
            mermaidCode: mermaidCode,
            description: 'Flowchart showing the process or workflow'
        };
    }

    /**
     * Generate concept map from topics
     */
    generateConceptMap(topics) {
        if (!topics || topics.length === 0) {
            return this.generatePlaceholderConceptMap();
        }

        // Build Mermaid mind map syntax
        let mermaidCode = 'mindmap\n  root((Study Topics))\n';
        
        topics.forEach((topic, index) => {
            const topicName = topic.title || topic.name || `Topic ${index + 1}`;
            const cleanName = topicName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
            mermaidCode += `    ${cleanName}\n`;
            
            // Add sub-concepts if available
            if (topic.subtopics && topic.subtopics.length > 0) {
                topic.subtopics.forEach((subtopic, subIndex) => {
                    const subName = subtopic.replace(/[^a-zA-Z0-9\s]/g, '').trim();
                    mermaidCode += `      ${subName}\n`;
                });
            }
        });

        return {
            type: 'concept-map',
            mermaidCode: mermaidCode,
            description: 'Concept map showing the relationship between study topics'
        };
    }

    /**
     * Generate graph from data
     */
    generateGraph(content) {
        // Extract data points
        const dataPoints = this.extractDataPoints(content);
        
        if (dataPoints.length === 0) {
            return this.generatePlaceholderGraph();
        }

        // Build Mermaid graph syntax
        let mermaidCode = 'xychart-beta\n';
        mermaidCode += '    title "Data Visualization"\n';
        mermaidCode += '    x-axis ["';
        mermaidCode += dataPoints.map(dp => dp.label).join('", "');
        mermaidCode += '"]\n';
        mermaidCode += '    y-axis "Value" 0 --> ';
        mermaidCode += Math.max(...dataPoints.map(dp => dp.value)) + 10;
        mermaidCode += '\n';
        mermaidCode += '    bar [';
        mermaidCode += dataPoints.map(dp => dp.value).join(', ');
        mermaidCode += ']\n';

        return {
            type: 'graph',
            mermaidCode: mermaidCode,
            description: 'Graph showing data visualization'
        };
    }

    /**
     * Generate table from structured content
     */
    generateTable(content) {
        // Extract table data
        const tableData = this.extractTableData(content);
        
        if (!tableData || tableData.headers.length === 0) {
            return this.generatePlaceholderTable();
        }

        // Build HTML table
        let html = '<table style="width:100%;border-collapse:collapse;margin:var(--spacing-4)0;">\n';
        
        // Header row
        html += '  <thead>\n    <tr style="background:var(--color-primary);color:var(--color-text-inverse);">\n';
        tableData.headers.forEach(header => {
            html += `      <th style="padding:var(--spacing-3);text-align:left;border:1px solid var(--color-border-light);">${header}</th>\n`;
        });
        html += '    </tr>\n  </thead>\n';
        
        // Body rows
        html += '  <tbody>\n';
        tableData.rows.forEach(row => {
            html += '    <tr>\n';
            row.forEach(cell => {
                html += `      <td style="padding:var(--spacing-3);border:1px solid var(--color-border-light);">${cell}</td>\n`;
            });
            html += '    </tr>\n';
        });
        html += '  </tbody>\n';
        html += '</table>';

        return {
            type: 'table',
            html: html,
            description: 'Table showing structured data'
        };
    }

    /**
     * Extract concepts from content
     */
    extractConcepts(content) {
        const concepts = [];
        const lines = content.split('\n');
        
        // Look for definition patterns
        const definitionPatterns = [
            /(.+?)\s+(?:is|are|means|refers to|can be defined as)\s+(.+)/i,
            /(.+?)\s*:\s*(.+)/i
        ];

        lines.forEach(line => {
            definitionPatterns.forEach(pattern => {
                const match = line.match(pattern);
                if (match && match[1].length > 3 && match[1].length < 50) {
                    concepts.push({
                        name: match[1].trim(),
                        definition: match[2].trim(),
                        relationships: []
                    });
                }
            });
        });

        // If no concepts found, create from headings
        if (concepts.length === 0) {
            const headings = content.match(/^[A-Z][A-Z\s]{5,50}$/gm) || [];
            headings.forEach((heading, index) => {
                concepts.push({
                    name: heading.trim(),
                    definition: '',
                    relationships: []
                });
            });
        }

        return concepts.slice(0, 8); // Limit to 8 concepts
    }

    /**
     * Extract process steps from content
     */
    extractProcessSteps(content) {
        const steps = [];
        const lines = content.split('\n');
        
        // Look for step patterns
        const stepPatterns = [
            /(?:step|first|second|third|next|then|finally|after)\s+(.+)/i,
            /^\d+\.\s+(.+)/i,
            /^-\s+(.+)/i
        ];

        lines.forEach(line => {
            stepPatterns.forEach(pattern => {
                const match = line.match(pattern);
                if (match && match[1].length > 5 && match[1].length < 100) {
                    steps.push({
                        label: match[1].trim(),
                        type: 'step'
                    });
                }
            });
        });

        // If no steps found, create from numbered list
        if (steps.length === 0) {
            const numberedItems = content.match(/^\d+\.\s+.+$/gm) || [];
            numberedItems.forEach(item => {
                steps.push({
                    label: item.replace(/^\d+\.\s+/, '').trim(),
                    type: 'step'
                });
            });
        }

        return steps.slice(0, 10); // Limit to 10 steps
    }

    /**
     * Extract data points from content
     */
    extractDataPoints(content) {
        const dataPoints = [];
        
        // Look for number patterns with labels
        const patterns = [
            /(.+?)[:\s]+(\d+(?:\.\d+)?)/g,
            /(\d+(?:\.\d+)?)\s*(?:percent|%|units?|items?)/gi
        ];

        let match;
        while ((match = patterns[0].exec(content)) !== null) {
            if (match[1].length > 2 && match[1].length < 30) {
                dataPoints.push({
                    label: match[1].trim(),
                    value: parseFloat(match[2])
                });
            }
        }

        // If no data points found, create sample
        if (dataPoints.length === 0) {
            return [
                { label: 'Topic 1', value: 80 },
                { label: 'Topic 2', value: 65 },
                { label: 'Topic 3', value: 90 },
                { label: 'Topic 4', value: 75 }
            ];
        }

        return dataPoints.slice(0, 8); // Limit to 8 data points
    }

    /**
     * Extract table data from content
     */
    extractTableData(content) {
        // Look for table-like structures
        const lines = content.split('\n');
        const tableLines = lines.filter(line => line.includes('|') || line.includes('\t'));
        
        if (tableLines.length < 2) {
            return null;
        }

        const headers = tableLines[0].split(/[|\t]/).map(h => h.trim()).filter(h => h);
        const rows = tableLines.slice(1).map(line => 
            line.split(/[|\t]/).map(cell => cell.trim()).filter(cell => cell)
        ).filter(row => row.length === headers.length);

        return {
            headers: headers.slice(0, 5), // Limit to 5 columns
            rows: rows.slice(0, 10) // Limit to 10 rows
        };
    }

    /**
     * Generate placeholder diagram
     */
    generatePlaceholderDiagram() {
        return {
            type: 'diagram',
            mermaidCode: `graph TD
    A[Main Concept] --> B[Related Concept 1]
    A --> C[Related Concept 2]
    B --> D[Detail 1]
    C --> E[Detail 2]`,
            description: 'Placeholder diagram - upload content to generate actual diagram'
        };
    }

    /**
     * Generate placeholder flowchart
     */
    generatePlaceholderFlowchart() {
        return {
            type: 'flowchart',
            mermaidCode: `graph LR
    A[Start] --> B[Process 1]
    B --> C[Process 2]
    C --> D[End]`,
            description: 'Placeholder flowchart - upload content to generate actual flowchart'
        };
    }

    /**
     * Generate placeholder concept map
     */
    generatePlaceholderConceptMap() {
        return {
            type: 'concept-map',
            mermaidCode: `mindmap
  root((Study Material))
    Topic 1
    Topic 2
    Topic 3
    Topic 4`,
            description: 'Placeholder concept map - upload content to generate actual concept map'
        };
    }

    /**
     * Generate placeholder graph
     */
    generatePlaceholderGraph() {
        return {
            type: 'graph',
            mermaidCode: `xychart-beta
    title "Sample Data"
    x-axis ["A", "B", "C", "D"]
    y-axis "Value" 0 --> 100
    bar [30, 50, 70, 90]`,
            description: 'Placeholder graph - upload content to generate actual graph'
        };
    }

    /**
     * Generate placeholder table
     */
    generatePlaceholderTable() {
        return {
            type: 'table',
            html: `<table style="width:100%;border-collapse:collapse;margin:var(--spacing-4)0;">
  <thead>
    <tr style="background:var(--color-primary);color:var(--color-text-inverse);">
      <th style="padding:var(--spacing-3);text-align:left;border:1px solid var(--color-border-light);">Column 1</th>
      <th style="padding:var(--spacing-3);text-align:left;border:1px solid var(--color-border-light);">Column 2</th>
      <th style="padding:var(--spacing-3);text-align:left;border:1px solid var(--color-border-light);">Column 3</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:var(--spacing-3);border:1px solid var(--color-border-light);">Data 1</td>
      <td style="padding:var(--spacing-3);border:1px solid var(--color-border-light);">Data 2</td>
      <td style="padding:var(--spacing-3);border:1px solid var(--color-border-light);">Data 3</td>
    </tr>
    <tr>
      <td style="padding:var(--spacing-3);border:1px solid var(--color-border-light);">Data 4</td>
      <td style="padding:var(--spacing-3);border:1px solid var(--color-border-light);">Data 5</td>
      <td style="padding:var(--spacing-3);border:1px solid var(--color-border-light);">Data 6</td>
    </tr>
  </tbody>
</table>`,
            description: 'Placeholder table - upload content to generate actual table'
        };
    }

    /**
     * Render Mermaid diagram to HTML
     */
    async renderMermaid(mermaidCode) {
        try {
            const { svg } = await mermaid.render('mermaid-diagram', mermaidCode);
            return svg;
        } catch (error) {
            console.error('Error rendering Mermaid diagram:', error);
            return `<div style="color:var(--color-error);padding:var(--spacing-4);">Error rendering diagram: ${error.message}</div>`;
        }
    }

    /**
     * Integrate visual with notes
     */
    integrateWithNotes(notes, visual) {
        let integratedContent = notes;
        
        // Find appropriate insertion point (after first heading)
        const headingMatch = notes.match(/^(#{2,3}\s+.+)$/m);
        if (headingMatch) {
            const insertionPoint = notes.indexOf(headingMatch[0]) + headingMatch[0].length;
            const visualHTML = this.visualToHTML(visual);
            integratedContent = notes.slice(0, insertionPoint) + '\n\n' + visualHTML + '\n\n' + notes.slice(insertionPoint);
        } else {
            // Insert at beginning if no heading found
            const visualHTML = this.visualToHTML(visual);
            integratedContent = visualHTML + '\n\n' + notes;
        }

        return integratedContent;
    }

    /**
     * Convert visual object to HTML
     */
    visualToHTML(visual) {
        if (visual.type === 'table') {
            return `<div class="visual-container" style="margin:var(--spacing-6)0;">
    <p style="font-size:var(--font-size-sm);color:var(--color-text-tertiary);margin-bottom:var(--spacing-2);">${visual.description}</p>
    ${visual.html}
</div>`;
        }

        return `<div class="visual-container" style="margin:var(--spacing-6)0;padding:var(--spacing-6);background:var(--color-bg-elevated);border-radius:var(--radius-xl);border:1px solid var(--color-border);">
    <p style="font-size:var(--font-size-sm);color:var(--color-text-tertiary);margin-bottom:var(--spacing-4);">${visual.description}</p>
    <div class="mermaid-diagram" id="mermaid-${Date.now()}">${visual.mermaidCode}</div>
</div>`;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VisualLearningEngine;
}

// Create global instance
const visualEngine = new VisualLearningEngine();
