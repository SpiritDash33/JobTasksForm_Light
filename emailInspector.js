class ParserTarget {
    constructor(text, startPos, endPos, confidence, fieldType = null, context = null) {
        this.text = text;
        this.startPos = startPos;
        this.endPos = endPos;
        this.confidence = confidence;
        this.fieldType = fieldType;
        this.context = context;
        this.domElement = null;
        this.resizeHandles = [];
        this.mappingDropdown = null;
        this.overlayDiv = null;
    }

    getBounds() {
        return { start: this.startPos, end: this.endPos, length: this.endPos - this.startPos };
    }

    contains(position) {
        return position >= this.startPos && position <= this.endPos;
    }

    overlaps(other) {
        return !(this.endPos <= other.startPos || other.endPos <= this.startPos);
    }
}

class EmailInspector {

    constructor() {
        this.resetApplicationState();
        this.initializeEventListeners();
        this.initializeRuleGenerators();
        this.initializeAutoTargetDetection();
    }

    initializeAutoTargetDetection() {
        // Pattern recognition rules for different field types
        this.patternRules = {
            building_code: [
                /\bSE[A-Z]\d{3,4}\b/g, // SEA104, SEACON1, etc.
                /\b[A-Z]{2,3}\d{1,4}\b/g // Generic site codes
            ],
            device_id: [
                /\b\d{6,10}\b/g, // Numeric device IDs
                /\bV\d{7,10}\b/g, // Device IDs starting with V
                /\bP\d{5,9}\b/g  // Device IDs starting with P
            ],
            job_name: [
                /\b(?:Service Call|Alarm)\b[^.!?\n]*/g, // Job descriptions
                /\b(?:Device Offline|Line Error|Alarm Active)\b[^.!?\n]*/g
            ],
            job_trouble_description: [
                /\b(?:Device Offline|Line Error|Alarm Active|Maintenance)\b[^.!?\n]*/g,
                /\b(?:Input Output|Power Supply|Reader|Contact)\b[^.!?\n]*/g
            ]
        };

        console.log('🔍 Auto-target detection initialized with', Object.keys(this.patternRules).length, 'field types');
    }

    // AUTO TARGET DETECTION - NEW HEAVY VISUAL SYSTEM
    autoDetectParserTargets() {
        this.detectedTargets = [];
        const content = this.rawContent;
        console.log('🔍 Starting auto-detection on content:', content.substring(0, 200) + '...');

        // Scan for each field type using pattern rules
        Object.entries(this.patternRules).forEach(([fieldType, patterns]) => {
            console.log(`📋 Scanning for ${fieldType} patterns...`);

            patterns.forEach(pattern => {
                const matches = content.matchAll(pattern);
                for (const match of matches) {
                    const targetText = match[0].trim();
                    const startPos = match.index;
                    const endPos = startPos + targetText.length;

                    // Skip if this overlaps with an existing target
                    if (this.detectedTargets.some(t => t.overlaps({text: targetText, startPos, endPos: startPos + targetText.length}))) {
                        console.log(`🚫 Skipping overlapping match: "${targetText}" for ${fieldType}`);
                        continue;
                    }

                    // Calculate confidence based on pattern match strength and context
                    const confidence = this.calculateConfidence(fieldType, targetText, startPos, content);

                    if (confidence >= 0.5) { // Minimum confidence threshold
                        const target = new ParserTarget(targetText, startPos, endPos, confidence, fieldType);

                        // Add contextual information
                        target.context = this.getTargetContext(content, startPos, startPos + targetText.length);

                        this.detectedTargets.push(target);
                        console.log(`🎯 Found target: "${targetText}" (${fieldType}, confidence: ${(confidence * 100).toFixed(1)}%)`);
                    }
                }
            });
        });

        // Sort by position for proper overlay ordering
        this.detectedTargets.sort((a, b) => a.startPos - b.startPos);

        console.log(`✅ Auto-detection complete: Found ${this.detectedTargets.length} parser targets`);

        return this.detectedTargets;
    }

    calculateConfidence(fieldType, text, position, content) {
        let confidence = 0.5; // Base confidence

        // Building codes: Higher confidence for specific patterns
        if (fieldType === 'building_code') {
            if (text.match(/\bSE[A-Z]\d{3,4}\b/)) confidence += 0.3; // SEA104 pattern
            if (text.length >= 5 && text.length <= 8) confidence += 0.1; // Right length
        }

        // Device IDs: Higher for numeric patterns
        if (fieldType === 'device_id') {
            if (text.match(/^\d+$/)) confidence += 0.2; // Pure numbers
            if (text.match(/^[VP]\d+$/)) confidence += 0.3; // Prefixed numbers (V1416404427, P130773915)
            if (text.length >= 6 && text.length <= 10) confidence += 0.2; // Right length range
        }

        // Context boosts: Near certain keywords
        const windowSize = 100;
        const beforeText = content.substring(Math.max(0, position - windowSize), position);
        const afterText = content.substring(position + text.length, position + text.length + windowSize);

        const contextText = (beforeText + afterText).toLowerCase();

        if (fieldType === 'job_name' && contextText.includes('service call')) confidence += 0.2;
        if (fieldType === 'job_trouble_description' && (contextText.includes('device offline') || contextText.includes('alarm active'))) confidence += 0.2;
        if (fieldType === 'building_code' && (contextText.includes('site') || contextText.includes('building'))) confidence += 0.1;

        // Position: Body content often more reliable than subject
        const contentLength = content.length;
        const positionRatio = position / contentLength;
        if (positionRatio > 0.2) confidence += 0.1; // Content after first 20% (likely body)

        return Math.min(1.0, confidence);
    }

    getTargetContext(content, startPos, endPos) {
        const windowSize = 50;
        return {
            before: content.substring(Math.max(0, startPos - windowSize), startPos).trim(),
            after: content.substring(endPos, Math.min(content.length, endPos + windowSize)).trim(),
            line: content.substring(0, startPos).split('\n').length
        };
    }

    // CREATE AUTO TARGETING CONTENT - NEW VISUAL SYSTEM
    createAutoTargetingContent() {
        if (!this.rawContent) return '<div class="error">No content available</div>';

        const contentHTML = this.rawContent.replace(/[&<>"']/g, match => ({
            '&': '&',
            '<': '<',
            '>': '>',
            '"': '"',
            "'": '&#39;'
        }[match])).split('\n').map((line, index) =>
            `<div class="content-line" data-line="${index}"><pre>${line || ' '}</pre></div>`
        ).join('');

        return `<div class="auto-targeting-content">
            <div class="unified-content" id="targeting-content">
                ${contentHTML}
            </div>

            <div class="targeting-controls">
                <div class="target-summary">
                    <h4>🎯 Parser Targets <span class="target-count" id="target-count">(${this.detectedTargets.length})</span></h4>
                    <div class="target-indicators" id="target-indicators">
                        ${this.createTargetIndicators()}
                    </div>
                </div>

                <div class="target-actions">
                    <button class="action-btn primary" onclick="emailInspector.regenerateTargets()">🔄 Rescan Content</button>
                    <button class="action-btn tertiary" onclick="emailInspector.clearAllTargets()">🗑️ Clear All</button>
                    <button class="action-btn" onclick="emailInspector.exportTargets()">💾 Export Mapping</button>
                </div>
            </div>
        </div>`;
    }

    createTargetIndicators() {
        if (this.detectedTargets.length === 0) {
            return '<p class="no-targets">No parser targets detected. Click "Rescan Content" to try again.</p>';
        }

        return this.detectedTargets.map((target, index) => `
            <div class="target-indicator" data-target-index="${index}" onclick="emailInspector.focusTarget(${index})">
                <div class="target-header">
                    <span class="target-icon">${this.getConfidenceIcon(target.confidence)}</span>
                    <span class="target-text">"${target.text}"</span>
                    <span class="confidence-badge">${(target.confidence * 100).toFixed(0)}%</span>
                </div>
                <div class="target-mapping">
                    <select class="field-dropdown" onchange="emailInspector.updateTargetMapping(${index}, this.value)">
                        <option value="unmapped" ${!target.fieldType ? 'selected' : ''}>Not Mapped</option>
                        ${this.createFieldOptions(target.fieldType)}
                    </select>
                </div>
            </div>
        `).join('');
    }

    getConfidenceIcon(confidence) {
        if (confidence >= 0.8) return '🟢'; // High
        if (confidence >= 0.6) return '🟡'; // Medium
        return '🔴'; // Low
    }

    createFieldOptions(currentType) {
        const fields = [
            { value: 'job_name', label: 'Job Name' },
            { value: 'building_code', label: 'Building Code' },
            { value: 'device_id', label: 'Device ID' },
            { value: 'job_trouble_description', label: 'Problem Description' },
            { value: 'job_number', label: 'Ticket Number' },
            { value: 'building_address', label: 'Address' }
        ];

        return fields.map(field =>
            `<option value="${field.value}" ${currentType === field.value ? 'selected' : ''}>${field.label}</option>`
        ).join('');
    }

    // VISUAL TARGET OVERLAYS - HEAVY GUI HANDLING
    initializeVisualTargets() {
        console.log('🎨 Initializing visual overlays for', this.detectedTargets.length, 'targets');

        const contentElement = document.getElementById('targeting-content');
        if (!contentElement) {
            console.error('❌ Content element not found');
            return;
        }

        this.detectedTargets.forEach((target, index) => {
            this.createVisualTargetOverlay(target, index);
        });

        console.log('✅ Visual target overlays initialized');
    }

    createVisualTargetOverlay(target, index) {
        // Get DOM element containing the target text
        const targetSpan = this.findTextElementForTarget(target);
        if (!targetSpan) {
            console.warn(`⚠️ Could not find DOM element for target ${index}: "${target.text}"`);
            return;
        }

        // Create overlay box
        const overlay = document.createElement('div');
        overlay.className = 'target-overlay';
        overlay.dataset.targetIndex = index;
        overlay.style.position = 'absolute';
        overlay.style.pointerEvents = 'all';
        overlay.style.zIndex = '1000';

        // Position the overlay
        const rect = targetSpan.getBoundingClientRect();
        const containerRect = targetSpan.parentElement.getBoundingClientRect();

        overlay.style.left = `${rect.left - containerRect.left - 4}px`;
        overlay.style.top = `${rect.top - containerRect.top - 2}px`;
        overlay.style.width = `${rect.width + 8}px`;
        overlay.style.height = `${rect.height + 4}px`;

        // Create resize handle elements (corners)
        const resizeHandles = this.createResizeHandles(overlay, target, index);

        overlay.appendChild(resizeHandles);

        // Insert overlay into DOM
        targetSpan.parentElement.appendChild(overlay);

        // Store reference
        target.overlayDiv = overlay;
        target.resizeHandles = resizeHandles.children;

        console.log(`🎯 Created overlay for target ${index}: "${target.text}" at (${parseInt(overlay.style.left)}x${parseInt(overlay.style.top)})`);
    }

    createResizeHandles(overlay, target, index) {
        const handles = document.createElement('div');
        handles.className = 'resize-handles';

        // Corner handles (all 4 corners)
        const corners = [
            { class: 'top-left', position: '0px, 0px' },
            { class: 'top-right', position: '100%, 0px' },
            { class: 'bottom-left', position: '0px, 100%' },
            { class: 'bottom-right', position: '100%, 100%' }
        ];

        corners.forEach(corner => {
            const handle = document.createElement('div');
            handle.className = `resize-handle resize-${corner.class}`;
            handle.style.position = 'absolute';
            handle.style.width = '8px';
            handle.style.height = '8px';
            handle.style.background = 'var(--accent-color, #007bff)';
            handle.style.borderRadius = '50%';
            handle.style.cursor = 'pointer';
            handle.style.pointerEvents = 'all';

            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.startResize(target, corner.class, e);
            });

            handles.appendChild(handle);
        });

        return handles;
    }

    findTextElementForTarget(target) {
        // Find the text element containing our target
        const contentEl = document.getElementById('targeting-content');
        if (!contentEl) return null;

        const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);

        let node;
        let currentPos = 0;

        while (node = walker.nextNode()) {
            const nodeText = node.textContent || '';
            const nodeEndPos = currentPos + nodeText.length;

            // Check if our target is within this text node
            if (target.startPos >= currentPos && target.endPos <= nodeEndPos) {
                return node.parentElement; // Return the containing element
            }

            currentPos += nodeText.length;
        }

        return null;
    }

    // RESIZE HANDLING - HEAVY GUI LOGIC
    startResize(target, handleType, event) {
        this.dragState = {
            type: 'resize',
            target: target,
            handle: handleType,
            startX: event.clientX,
            startY: event.clientY,
            startWidth: parseInt(target.overlayDiv.style.width),
            startHeight: parseInt(target.overlayDiv.style.height),
            startLeft: parseInt(target.overlayDiv.style.left),
            startTop: parseInt(target.overlayDiv.style.top)
        };

        console.log(`🔧 Started resize on target "${target.text}" with ${handleType} handle`);

        // Add global mouse events
        document.addEventListener('mousemove', this.handleResizeMove.bind(this));
        document.addEventListener('mouseup', this.handleResizeEnd.bind(this));

        event.preventDefault();
    }

    handleResizeMove(event) {
        if (!this.dragState || this.dragState.type !== 'resize') return;

        const deltaX = event.clientX - this.dragState.startX;
        const deltaY = event.clientY - this.dragState.startY;

        const target = this.dragState.target;
        let newWidth = this.dragState.startWidth;
        let newHeight = this.dragState.startHeight;
        let newLeft = this.dragState.startLeft;
        let newTop = this.dragState.startTop;

        switch (this.dragState.handle) {
            case 'top-left':
                newWidth = Math.max(20, this.dragState.startWidth - deltaX);
                newHeight = Math.max(20, this.dragState.startHeight - deltaY);
                newLeft = this.dragState.startLeft + deltaX;
                newTop = this.dragState.startTop + deltaY;
                break;

            case 'top-right':
                newWidth = Math.max(20, this.dragState.startWidth + deltaX);
                newHeight = Math.max(20, this.dragState.startHeight - deltaY);
                newTop = this.dragState.startTop + deltaY;
                break;

            case 'bottom-left':
                newWidth = Math.max(20, this.dragState.startWidth - deltaX);
                newHeight = Math.max(20, this.dragState.startHeight + deltaY);
                newLeft = this.dragState.startLeft + deltaX;
                break;

            case 'bottom-right':
                newWidth = Math.max(20, this.dragState.startWidth + deltaX);
                newHeight = Math.max(20, this.dragState.startHeight + deltaY);
                break;
        }

        // Apply new dimensions
        target.overlayDiv.style.width = newWidth + 'px';
        target.overlayDiv.style.height = newHeight + 'px';
        target.overlayDiv.style.left = newLeft + 'px';
        target.overlayDiv.style.top = newTop + 'px';
    }

    handleResizeEnd() {
        if (!this.dragState || this.dragState.type !== 'resize') return;

        console.log(`✅ Finished resize on target "${this.dragState.target.text}"`);

        // Update target bounds based on visual position
        this.updateTargetBoundsFromVisual(this.dragState.target);

        // Remove global events
        document.removeEventListener('mousemove', this.handleResizeMove.bind(this));
        document.removeEventListener('mouseup', this.handleResizeEnd.bind(this));

        this.dragState = null;
    }

    updateTargetBoundsFromVisual(target) {
        // Convert visual overlay position back to text coordinates
        const overlay = target.overlayDiv;
        const rect = overlay.getBoundingClientRect();
        const containerRect = overlay.parentElement.getBoundingClientRect();

        // This is a simplified conversion - would need more sophisticated logic for precise text selection
        // For now, just update the bounds proportionally
        const width = parseInt(overlay.style.width);
        const approxCharWidth = width / target.text.length;
        const charCount = Math.round(width / 8); // Rough estimate: 8px per character

        target.endPos = target.startPos + Math.max(target.text.length, charCount);

        console.log(`📏 Updated target bounds for "${target.text}": ${target.startPos} - ${target.endPos}`);
    }

    // INTERACTION METHODS
    focusTarget(index) {
        const target = this.detectedTargets[index];
        if (!target || !target.overlayDiv) return;

        // Scroll target into view
        target.overlayDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Highlight the overlay temporarily
        target.overlayDiv.style.boxShadow = '0 0 20px var(--accent-color, #007bff)';
        setTimeout(() => {
            target.overlayDiv.style.boxShadow = '';
        }, 2000);

        console.log(`🎯 Focused on target ${index}: "${target.text}"`);
    }

    updateTargetMapping(index, newFieldType) {
        const target = this.detectedTargets[index];
        if (!target) return;

        target.fieldType = newFieldType;
        target.confidence = newFieldType !== 'unmapped' ? Math.min(1.0, target.confidence + 0.2) : target.confidence;

        console.log(`🔗 Updated target ${index} mapping to "${newFieldType}"`);

        // Update visual indicator
        this.updateTargetIndicator(index);
    }

    updateTargetIndicator(index) {
        const indicator = document.querySelector(`.target-indicator[data-target-index="${index}"]`);
        const dropdown = indicator?.querySelector('.field-dropdown');

        if (dropdown && this.detectedTargets[index]) {
            const selectedValue = this.detectedTargets[index].fieldType || 'unmapped';
            dropdown.value = selectedValue;
        }
    }

    regenerateTargets() {
        console.log('🔄 Regenerating parser targets...');
        this.autoDetectParserTargets();
        this.displayUnifiedInteractiveView();
    }

    clearAllTargets() {
        console.log('🗑️ Clearing all parser targets...');
        this.detectedTargets = [];
        this.displayUnifiedInteractiveView();
    }

    exportTargets() {
        const exportData = {
            email: this.currentEmail,
            rawContent: this.rawContent,
            detectedTargets: this.detectedTargets.map(t => ({
                text: t.text,
                startPos: t.startPos,
                endPos: t.endPos,
                confidence: t.confidence,
                fieldType: t.fieldType,
                context: t.context
            }))
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'parser_targets_mapping.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        console.log('💾 Exported parser target mapping');
    }

    resetApplicationState() {
        this.currentEmail = null;
        this.parsedData = null;
        this.selectedText = '';
        this.selectionCoords = null;
        this.attachments = [];
        this.originalContent = null;
        this.mimeParts = null;
        this.detectedTargets = [];
        this.isTargetingMode = false;
        this.dragState = null;
    }

    initializeEventListeners() {
        // File drop zone events
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');

        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');
            dropZone.classList.add('processing');

            console.log('Drop event triggered');
            console.log('Files in dataTransfer:', e.dataTransfer.files);

            if (e.dataTransfer.files.length === 0) {
                dropZone.classList.remove('processing');
                this.showError('No files were dropped. Try again or use the file picker.');
                return;
            }

            this.handleFiles(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Content tab switching
        document.querySelectorAll('.content-tab').forEach(button => {
            button.addEventListener('click', () => this.switchTab(button.dataset.tab));
        });

        // MIME parts event delegation
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('mime-toggle')) {
                this.toggleMimePart(e.target);
            } else if (e.target.classList.contains('download-btn')) {
                this.downloadMimePart(e.target.dataset.partIndex);
            }
        });

        // Text selection in email content
        const emailContent = document.getElementById('emailContent');
        emailContent.addEventListener('mouseup', () => this.handleTextSelection());
        emailContent.addEventListener('keyup', () => this.handleTextSelection());

        // Rule generation
        document.getElementById('generateRule').addEventListener('click', () => this.generateRule());
        document.getElementById('copyRules').addEventListener('click', () => this.copyRules());
        document.getElementById('integrateWithParser').addEventListener('click', () => this.testWithParser());
        document.getElementById('sendToWMS').addEventListener('click', () => this.sendToWorkManagementSystem());
    }

    initializeRuleGenerators() {
        this.ruleGenerators = {
            regex: this.generateRegexRule.bind(this),
            coordinates: this.generateCoordinateRule.bind(this),
            css: this.generateCSSRule.bind(this),
            xpath: this.generateXPathRule.bind(this)
        };
    }

    async handleFiles(files) {
        console.log('handleFiles called with', files.length, 'files');

        if (files.length === 0) {
            this.showError('No files selected. Please try again.');
            return;
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            console.log(`File ${i}:`, file.name, file.type, file.size, 'bytes');

            if (file.name.toLowerCase().endsWith('.eml') || file.name.toLowerCase().endsWith('.msg')) {
                console.log('Processing supported file:', file.name);
                await this.processEmailFile(file);
                break; // Process only one file at a time
            } else {
                console.log('Skipping unsupported file:', file.name);
            }
        }
    }

    async processEmailFile(file) {
        try {
            console.log('Processing file:', file.name);

            this.updateFileInfo(file);
            const content = await this.readFileContent(file);

            console.log('Content loaded, parsing...');

            if (file.name.toLowerCase().endsWith('.eml')) {
                this.currentEmail = EmailParser.parseEml(content);
                this.parsedData = this.currentEmail;
            } else if (file.name.toLowerCase().endsWith('.msg')) {
                this.currentEmail = EmailParser.parseMsg(content);
                this.parsedData = this.currentEmail;
            }

            // Parse email structure for display
            this.displayEmailContent(content, file.name);
            this.displayParsedResults();
            this.resetSelectionInfo();

            console.log('Email processed successfully:', this.currentEmail);

        } catch (error) {
            console.error('Error processing email file:', error);
            this.showError('Failed to process email file: ' + error.message);
        } finally {
            // Always remove processing state
            const dropZone = document.getElementById('dropZone');
            dropZone.classList.remove('dragover', 'processing');
        }
    }

    updateFileInfo(file) {
        const fileInfoDiv = document.getElementById('fileInfo');
        fileInfoDiv.innerHTML = `
            <strong>${file.name}</strong><br>
            ${(file.size / 1024).toFixed(1)} KB • ${file.name.split('.').pop().toUpperCase()} file
        `;

        // Update workflow steps
        this.updateWorkflowStep('upload', 'completed');
        this.updateWorkflowStep('inspect', 'active');
        this.updateWorkflowStep('select', null); // Reset later steps
        this.updateWorkflowStep('generate', null);
        this.updateWorkflowStep('integrate', null);
    }

    async readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => resolve(e.target.result);

            reader.onerror = () => reject(new Error('Failed to read file'));

            if (file.name.toLowerCase().endsWith('.eml')) {
                reader.readAsText(file);
            } else {
                reader.readAsArrayBuffer(file);
            }
        });
    }

    displayEmailContent(content, filename) {
        console.log('Displaying content for:', filename);
        console.log('Content type:', typeof content);
        console.log('Content length:', content.length || content.byteLength);

        // Store different versions of content for different views
        this.originalContent = content;
        this.rawContent = this.convertContentToDisplayableText(content, filename);
        this.hexContent = this.convertContentToHex(content, filename);

        // Parse MIME parts for structured display
        this.mimeParts = this.parseMimeParts(content, filename);

        // Create unified interactive view instead of tabs
        this.displayUnifiedInteractiveView();
    }

    // Create INLINE EDITING view with rich HTML content
    displayUnifiedInteractiveView() {
        const emailContent = document.getElementById('emailContent');

        if (this.currentEmail && this.rawContent) {
            // Create rich interactive HTML content instead of plain text
            const interactiveHTML = `<div class="unified-inline-view">
                <div class="view-header">
                    <h2>📧 Email Inspector - Inline Editing Mode</h2>
                    <div class="view-subtitle">
                        <span class="status-indicator ${this.getValidationClass()}">
                            ${this.getInlineValidationStatus()}
                        </span>
                        <span class="action-hint">💡 Click values to edit inline • Select text for rules</span>
                    </div>
                </div>
                
                ${this.createUnifiedInlineContent()}
            </div>`;

            // Hide textarea and show rich content
            emailContent.style.display = 'none';
            
            // Insert HTML content
            const displayDiv = document.querySelector('.content-display');
            displayDiv.innerHTML = interactiveHTML;

        } else {
            // No email loaded - show placeholder in textarea
            emailContent.value = 'Load an email file to inspect its content...';
            emailContent.style.display = 'block';
        }

        // Add enhanced event handlers for real interactivity
        this.attachEnhancedInteractiveHandlers();

        // Update workflow - only mark inspect step complete, don't auto-advance
        this.updateWorkflowStep('inspect', 'completed');
    }

    // CREATE UNIFIED INLINE CONTENT - ALL FIELDS EMBEDDED AS EDITABLE ELEMENTS
    createUnifiedInlineContent() {
        if (!this.currentEmail || !this.rawContent) return '';

        let inlineHTML = '';

        // Create the email content with ALL editable fields inline
        const lines = this.rawContent.split('\n');
        let contentHTML = '';

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            // Replace building codes with editable inline spans
            if (this.currentEmail.building_code && line.includes(this.currentEmail.building_code)) {
                const safeId = `inline-building-${i}`;
                line = line.replace(
                    new RegExp(`\\b${this.currentEmail.building_code}\\b`, 'g'),
                    `<span class="inline-editable-field building-field" id="${safeId}" data-field="building_code" data-original="${this.currentEmail.building_code}" contenteditable="true" onmouseover="emailInspector.showHoverInfo('building', '${this.currentEmail.building_code}')" onmouseout="emailInspector.hideHoverInfo()">${this.currentEmail.building_code}</span>`
                );
            }

            // Replace device IDs with editable inline spans
            if (this.currentEmail.device_id && line.includes(this.currentEmail.device_id)) {
                const safeId = `inline-device-${i}`;
                line = line.replace(
                    new RegExp(`\\b${this.currentEmail.device_id}\\b`, 'g'),
                    `<span class="inline-editable-field device-field" id="${safeId}" data-field="device_id" data-original="${this.currentEmail.device_id}" contenteditable="true" onmouseover="emailInspector.showHoverInfo('device', '${this.currentEmail.device_id}')" onmouseout="emailInspector.hideHoverInfo()">${this.currentEmail.device_id}</span>`
                );
            }

            contentHTML += `<div class="content-line">${line || '&nbsp;'}</div>`;
        }

        inlineHTML += `<div class="unified-content">
            ${contentHTML}
        </div>`;

        // Add a summary section at the bottom showing all editable fields
        inlineHTML += `<div class="inline-summary">
            <h4>✨ EDITABLE FIELDS SUMMARY</h4>
            <div class="summary-fields">
                <div class="summary-field">
                    <span class="field-label">BUILDING:</span>
                    <span class="field-value" contenteditable="true" data-field="building_code">"${this.currentEmail.building_code || '[empty]'}"</span>
                </div>
                <div class="summary-field">
                    <span class="field-label">DEVICE:</span>
                    <span class="field-value" contenteditable="true" data-field="device_id">"${this.currentEmail.device_id || '[empty]'}"</span>
                </div>
                <div class="summary-field">
                    <span class="field-label">JOB NAME:</span>
                    <span class="field-value" contenteditable="true" data-field="job_name">"${this.currentEmail.job_name || '[empty]'}"</span>
                </div>
            </div>
        </div>`;

        return inlineHTML;
    }

    // Get validation status for inline display
    getInlineValidationStatus() {
        const status = this.currentEmail.email_parse_title_validation_status || 'valid';
        return status === 'error' ? '❌ ERRORS' : status === 'warning' ? '⚠️ WARNINGS' : '✅ VALID';
    }

    // HOVERBOARD METHODS - Show context info when hovering over fields
    showHoverInfo(fieldType, value) {
        let info = '';
        switch(fieldType) {
            case 'building':
                info = `🏢 BUILDING CODE: ${value}\n📝 Click to edit building/site identifier\n🔍 Status: ${this.getFieldStatus('building_code')}`;
                break;
            case 'device':
                info = `📱 DEVICE ID: ${value}\n📝 Click to edit device/ticket number\n🔍 Status: ${this.getFieldStatus('device_id')}`;
                break;
        }

        this.updateHoverboard(info);
    }

    hideHoverInfo() {
        this.hideHoverboard();
    }

    getFieldStatus(fieldName) {
        if (!this.currentEmail) return 'Unknown';

        const value = this.currentEmail[fieldName];
        if (!value || value.trim() === '') return 'Empty';
        if (this.currentEmail.email_parse_title_validation_status === 'error') return 'Has Errors';
        if (this.currentEmail.email_parse_title_validation_status === 'warning') return 'Warnings';
        return 'Valid';
    }

    updateHoverboard(content) {
        if (!this.hoverboard) {
            this.createHoverboard();
        }

        const lines = content.split('\n');
        const boardHTML = lines.map(line => `<div class="hoverboard-line">${line}</div>`).join('');

        this.hoverboard.innerHTML = boardHTML;
        this.hoverboard.classList.add('visible');
    }

    hideHoverboard() {
        if (this.hoverboard) {
            this.hoverboard.classList.remove('visible');
        }
    }

    createHoverboard() {
        if (this.hoverboard) return;

        this.hoverboard = document.createElement('div');
        this.hoverboard.className = 'hoverboard';
        this.hoverboard.id = 'hoverboard';

        document.body.appendChild(this.hoverboard);

        // Initially hidden
        this.hoverboard.classList.remove('visible');
    }

    // Create clickable/editable field display - enhanced interactive experience
    createEditableField(icon, fieldName, fieldValue, description) {
        const displayValue = fieldValue || '[empty]';
        const fieldId = `editable-${fieldName}`;
        const safeFieldName = fieldName.replace(/[^a-zA-Z0-9]/g, '_');

        // Enhanced: clickable labels AND values, with immediate editing
        return `<div class="interactive-field" data-field="${fieldName}" onclick="emailInspector.startFieldEdit('${fieldName}')">
<span class="field-icon">${icon}</span>
<span class="field-name">${this.fieldNameToDisplay(fieldName)}:</span>
<span class="field-value editable-value" id="val-${safeFieldName}" contenteditable="false">${displayValue}</span>
<button class="edit-btn" title="${description}">✏️</button>
</div>`;
    }

    // Convert field names to readable display names
    fieldNameToDisplay(fieldName) {
        switch(fieldName) {
            case 'job_name': return 'JOB NAME';
            case 'building_code': return 'BUILDING';
            case 'device_id': return 'DEVICE';
            case 'job_trouble_description': return 'PROBLEM';
            case 'job_number': return 'TICKET';
            case 'building_address': return 'ADDRESS';
            default: return fieldName.toUpperCase();
        }
    }

    // Add highlighted mappings to raw content
    createHighlightedContent(rawContent) {
        if (!this.currentEmail) return rawContent;

        let highlighted = rawContent;

        // Add highlighting indicators for extracted fields (simplified for textarea display)
        if (this.currentEmail.building_code) {
            // Mark where building was extracted from (simplified)
            highlighted = highlighted.replace(new RegExp(`\\b${this.currentEmail.building_code}\\b`, 'g'),
                `[BUILDING:${this.currentEmail.building_code}]`);
        }

        if (this.currentEmail.device_id) {
            highlighted = highlighted.replace(new RegExp(`\\b${this.currentEmail.device_id}\\b`, 'g'),
                `[DEVICE:${this.currentEmail.device_id}]`);
        }

        return highlighted;
    }

    // Attach click handlers to editable field indicators
    attachInteractiveHandlers() {
        const emailContent = document.getElementById('emailContent');

        // Simple click detection for editable fields
        emailContent.addEventListener('click', (e) => {
            const text = emailContent.value;
            const startPos = emailContent.selectionStart;

            // Find which line was clicked
            const lines = text.substring(0, startPos).split('\n');
            const currentLine = lines[lines.length - 1];

            // Check if clicked on an editable field
            if (currentLine.includes('📝 (click to edit:')) {
                this.handleFieldEdit(currentLine);
            }
        });
    }

    // Handle editing of fields directly in the unified view
    handleFieldEdit(clickedLine) {
        // Extract field name from clicked line
        let fieldName = '';
        let currentValue = '';

        if (clickedLine.includes('JOB NAME:')) {
            fieldName = 'job_name';
            currentValue = this.currentEmail.job_name || '';
        } else if (clickedLine.includes('BUILDING:')) {
            fieldName = 'building_code';
            currentValue = this.currentEmail.building_code || '';
        } else if (clickedLine.includes('DEVICE:')) {
            fieldName = 'device_id';
            currentValue = this.currentEmail.device_id || '';
        } else if (clickedLine.includes('PROBLEM:')) {
            fieldName = 'job_trouble_description';
            currentValue = this.currentEmail.job_trouble_description || '';
        } else if (clickedLine.includes('TICKET:')) {
            fieldName = 'job_number';
            currentValue = this.currentEmail.job_number || '';
        } else if (clickedLine.includes('ADDRESS:')) {
            fieldName = 'building_address';
            currentValue = this.currentEmail.building_address || '';
        }

        if (fieldName) {
            // Prompt for new value
            const newValue = prompt(`Edit ${fieldName}:`, currentValue);
            if (newValue !== null) {
                // Update the field
                this.currentEmail[fieldName] = newValue.trim();

                // Refresh the display
                this.displayUnifiedInteractiveView();

                alert(`Updated ${fieldName} to: "${newValue}"`);
            }
        }
    }

    // Get validation status for display
    getValidationStatus() {
        const status = this.currentEmail.email_parse_title_validation_status || 'valid';

        switch(status) {
            case 'error': return '❌ ERRORS DETECTED';
            case 'warning': return '⚠️ WARNINGS PRESENT';
            case 'valid': return '✅ ALL VALID';
            default: return '❓ UNKNOWN STATUS';
        }
    }

    // Get CSS class for validation status
    getValidationClass() {
        const status = this.currentEmail.email_parse_title_validation_status || 'valid';

        switch(status) {
            case 'error': return 'error';
            case 'warning': return 'warning';
            case 'valid': return 'success';
            default: return '';
        }
    }

    // Create REAL interactive HTML field element (not just text)
    createInteractiveFieldElement(icon, fieldName, fieldValue, description, displayName) {
        const safeFieldName = fieldName.replace(/[^a-zA-Z0-9]/g, '_');
        const valueId = `field-val-${safeFieldName}`;
        const displayValue = fieldValue || '[empty]';

        return `
            <div class="interactive-field" data-field="${fieldName}">
                <div class="field-header">
                    <span class="field-icon">${icon}</span>
                    <span class="field-label">${displayName}:</span>
                </div>
                <div class="field-content">
                    <div id="${valueId}" class="field-value interactive-value" contenteditable="true" data-field="${fieldName}" data-original="${displayValue}" title="${description}">${displayValue}</div>
                    <button class="field-reset-btn" onclick="emailInspector.resetField('${fieldName}')" title="Reset to original value">↺</button>
                </div>
            </div>
        `;
    }

    // Create REAL interactive content with highlights
    createRealInteractiveContent(rawContent) {
        // Split content into lines and create interactive spans for highlighted fields
        const lines = rawContent.split('\n');
        let processedLines = [];

        for (let i = 0; i < lines.length; i++) {
            let lineHtml = lines[i];

            // Add highlighting for building codes
            if (this.currentEmail.building_code && lineHtml.includes(this.currentEmail.building_code)) {
                lineHtml = lineHtml.replace(
                    new RegExp(`\\b${this.currentEmail.building_code}\\b`, 'g'),
                    `<span class="extraction-highlight building-highlight" title="Building Code: ${this.currentEmail.building_code}">🇧 ${this.currentEmail.building_code}</span>`
                );
            }

            // Add highlighting for device IDs
            if (this.currentEmail.device_id && lineHtml.includes(this.currentEmail.device_id)) {
                lineHtml = lineHtml.replace(
                    new RegExp(`\\b${this.currentEmail.device_id}\\b`, 'g'),
                    `<span class="extraction-highlight device-highlight" title="Device ID: ${this.currentEmail.device_id}">📱 ${this.currentEmail.device_id}</span>`
                );
            }

            processedLines.push(`<div class="content-line">${lineHtml || '\u00A0'}</div>`);
        }

        return `<div class="interactive-content">${processedLines.join('')}</div>`;
    }

    // Attach REAL enhanced interactive event handlers
    attachEnhancedInteractiveHandlers() {
        const self = this;

        // Handle interactive field editing (for inline contentEditable spans)
        document.addEventListener('input', function(e) {
            if (e.target.classList.contains('inline-editable-field') ||
                e.target.classList.contains('inline-editable-field-span')) {
                const fieldName = e.target.dataset.field;
                if (fieldName && self.currentEmail) {
                    self.currentEmail[fieldName] = e.target.textContent.trim();
                    console.log(`Updated ${fieldName} to: "${self.currentEmail[fieldName]}"`);
                }
            }
        });

        // Handle summary field editing
        const summaryFields = document.querySelectorAll('.summary-field .field-value');
        summaryFields.forEach(field => {
            field.addEventListener('input', function(e) {
                const fieldName = this.dataset.field;
                if (fieldName && self.currentEmail) {
                    self.currentEmail[fieldName] = this.textContent.trim();
                    console.log(`Updated ${fieldName} to: "${self.currentEmail[fieldName]}"`);
                }
            });
        });

        // Handle TEXT SELECTION in unified content area for rule generation
        const unifiedContent = document.querySelector('.unified-content');
        if (unifiedContent) {
            let lastClickTime = 0;
            let lastSelectionText = '';

            // Add selection event listeners
            unifiedContent.addEventListener('mouseup', (e) => {
                // Small delay to let selection settle
                setTimeout(() => self.handleTextSelectionInUnifiedView(), 10);
            });

            unifiedContent.addEventListener('keyup', (e) => {
                // Handle keyboard selection
                if (e.shiftKey || e.ctrlKey) {
                    setTimeout(() => self.handleTextSelectionInUnifiedView(), 10);
                }
            });

            // Add visual feedback for selection
            unifiedContent.addEventListener('mousedown', (e) => {
                // Clear previous selection highlight
                document.querySelectorAll('.selection-highlight').forEach(el => {
                    el.classList.remove('selection-highlight');
                });
            });

            // Handle click to clear selection - UPDATED FOR CONTENTEDITABLE
            unifiedContent.addEventListener('click', (e) => {
                const currentTime = Date.now();
                const selection = window.getSelection();

                // Check if this is a double-click (don't clear on double-click)
                if (currentTime - lastClickTime < 300) {
                    lastClickTime = currentTime;
                    return;
                }
                lastClickTime = currentTime;

                // Check if clicking on a target overlay or resize handle
                const clickedTarget = e.target.closest('.target-overlay, .resize-handle, .action-btn, .field-dropdown, .target-indicator');

                if (clickedTarget) {
                    return; // Don't clear selection if clicking on interactive elements
                }

                // Check if we have a real text selection vs collapsed cursor
                const currentSelectionText = selection.toString().trim();

                // If no selection change occurred and we clicked (indicates deselection attempt)
                if (currentSelectionText === '' || currentSelectionText === lastSelectionText) {
                    setTimeout(() => {
                        const stillSelected = window.getSelection().toString().trim();
                        if (stillSelected === '' || stillSelected.length < 3) {
                            self.clearTextSelection();
                        }
                    }, 50);
                }

                lastSelectionText = currentSelectionText;
            });

            // Listen for selection changes globally
            document.addEventListener('selectionchange', (e) => {
                const selection = window.getSelection();

                // Check if selection is in our unified content area
                if (selection.rangeCount > 0 && selection.rangeCount <= 1) {
                    const range = selection.getRangeAt(0);
                    const container = unifiedContent.contains(range.startContainer);

                    if (container) {
                        // Selection is in our content area
                        const selectedText = selection.toString().trim();

                        if (selectedText && selectedText.length > 2) {
                            // We have a meaningful selection - update it
                            setTimeout(() => self.handleTextSelectionInUnifiedView(), 10);
                        } else if (selectedText === '' && !selection.isCollapsed && range.collapsed) {
                            // Selection was cleared - clear our tracking
                            setTimeout(() => self.clearTextSelection(), 50);
                        }
                    } else {
                        // Selection moved outside our content area - clear it
                        setTimeout(() => self.clearTextSelection(), 50);
                    }
                } else if (selection.isCollapsed) {
                    // No active selection
                    setTimeout(() => {
                        const stillSelected = window.getSelection().toString().trim();
                        if (stillSelected === '' || stillSelected.length < 3) {
                            self.clearTextSelection();
                        }
                    }, 50);
                }
            });
        }
    }

    // Clear text selection when clicking outside or when selection is removed
    clearTextSelection() {
        this.selectedText = '';
        this.selectionCoords = null;

        // Clear browser selection completely
        try {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                selection.removeAllRanges();
            }
        } catch (e) {
            // Ignore errors if selection clearing fails
            console.warn('Could not clear browser selection:', e);
        }

        // Reset selection info panel
        this.resetSelectionInfo();

        // Reset rule preview
        this.updateRulePreview();

        // Reset workflow steps - when clearing selection, just unhighlight Select/Generate/Integrate
        // Leave the workflow at Upload->Inspect state (no special highlighting)
        this.updateWorkflowStep('select', null);
        this.updateWorkflowStep('generate', null);
        this.updateWorkflowStep('integrate', null);

        // Clear any rule output content if it was just for the previous selection
        const ruleOutput = document.getElementById('ruleOutput');
        if (ruleOutput) {
            ruleOutput.innerHTML = '// Select some text in the content above to see rule preview...';
        }

        // Remove any selection highlight
        document.querySelectorAll('.selection-highlight').forEach(el => {
            el.classList.remove('selection-highlight');
        });

        // Remove any floating selection indicator
        document.querySelectorAll('.selection-indicator').forEach(el => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });

        console.log('Text selection cleared - workflow reset to inspect mode');
    }

    // Handle text selection specifically in the unified content view
    handleTextSelectionInUnifiedView() {
        const selection = window.getSelection();

        if (selection.rangeCount > 0 && !selection.isCollapsed) {
            const selectedText = selection.toString().trim();

            if (selectedText && selectedText.length > 2) { // Minimum 3 chars
                this.selectedText = selectedText;

                // Calculate selection coordinates in content
                this.selectionCoords = this.getSelectionCoordsInUnifiedView(selection);

                // Update rule preview
                this.updateRulePreview();

                // Show selection info
                this.updateSelectionInfo();

                // Update workflow step
                this.updateWorkflowStep('select', 'completed');
                this.updateWorkflowStep('generate', 'active');

                console.log('Selected text for rule generation:', selectedText);

                // Visual feedback - highlight selected content
                this.showSelectionHighlight(selection);
            }
        } else {
            // Selection became empty - clear it
            this.clearTextSelection();
        }
    }

    // Get selection coordinates in the unified content view
    getSelectionCoordsInUnifiedView(selection) {
        const range = selection.getRangeAt(0);
        const unifiedContent = document.querySelector('.unified-content');

        if (!unifiedContent) return null;

        // Get the full text content
        const fullText = unifiedContent.textContent || '';
        const selectedText = selection.toString();

        // Find the position of selected text in full content
        // This is a simplified approach - could be enhanced for more precision
        const beforeText = fullText.substring(0, fullText.indexOf(selectedText));

        return {
            start: beforeText.length,
            end: beforeText.length + selectedText.length,
            line: (beforeText.match(/\n/g) || []).length + 1,
            char: beforeText.length - beforeText.lastIndexOf('\n'),
            selectedText: selectedText,
            beforeContext: beforeText.substring(-50), // Last 50 chars
            afterContext: fullText.substring(beforeText.length + selectedText.length, beforeText.length + selectedText.length + 50)
        };
    }

    // Show visual highlight for selected content
    showSelectionHighlight(selection) {
        try {
            // Create a visual indicator for the selection
            const selectionIndicator = document.createElement('div');
            selectionIndicator.className = 'selection-indicator';
            selectionIndicator.textContent = `🎯 Selected: "${this.selectedText.length} chars"`;

            selectionIndicator.style.position = 'fixed';
            selectionIndicator.style.top = '200px';
            selectionIndicator.style.right = '20px';
            selectionIndicator.style.background = 'rgba(0, 123, 255, 0.9)';
            selectionIndicator.style.color = 'white';
            selectionIndicator.style.padding = '8px 12px';
            selectionIndicator.style.borderRadius = '20px';
            selectionIndicator.style.fontSize = '12px';
            selectionIndicator.style.zIndex = '9999';
            selectionIndicator.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';

            document.body.appendChild(selectionIndicator);

            // Auto-remove after 3 seconds
            setTimeout(() => {
                if (selectionIndicator.parentNode) {
                    selectionIndicator.parentNode.removeChild(selectionIndicator);
                }
            }, 3000);

        } catch (error) {
            console.warn('Error showing selection highlight:', error);
        }
    }

    // Update live content highlights when fields change
    updateLiveHighlights() {
        const contentArea = document.querySelector('.interactive-content');
        if (!contentArea) return;

        const newContent = this.createRealInteractiveContent(this.rawContent);
        contentArea.innerHTML = newContent;

        // Re-attach handlers for new content
        this.attachEnhancedInteractiveHandlers();
    }

    // Reset field to original/parsed value
    resetField(fieldName) {
        if (!this.currentEmail) return;

        // Find the most reliable source - either use currentEmail values or extract from raw content
        let resetValue = '';

        // For demonstration, let's extract from original parsing results
        switch(fieldName) {
            case 'job_name':
                resetValue = this.currentEmail.job_name || '[empty]';
                break;
            case 'building_code':
                resetValue = this.currentEmail.building_code || '[empty]';
                break;
            case 'device_id':
                resetValue = this.currentEmail.device_id || '[empty]';
                break;
            case 'job_trouble_description':
                resetValue = this.currentEmail.job_trouble_description || '[empty]';
                break;
            case 'job_number':
                resetValue = this.currentEmail.job_number || '[empty]';
                break;
            case 'building_address':
                resetValue = this.currentEmail.building_address || '[empty]';
                break;
        }

        // Update the field value in our data
        this.currentEmail[fieldName] = resetValue;

        // Update the display
        const safeFieldName = fieldName.replace(/[^a-zA-Z0-9]/g, '_');
        const valueElement = document.getElementById(`field-val-${safeFieldName}`);
        if (valueElement) {
            valueElement.textContent = resetValue;
        }

        // Update highlights
        this.updateLiveHighlights();

        console.log(`Reset ${fieldName} to: "${resetValue}"`);
    }

    // Update rule preview when text is selected
    updateRulePreview() {
        if (!this.selectedText) {
            const ruleOutput = document.getElementById('ruleOutput');
            if (ruleOutput) {
                ruleOutput.innerHTML = '// Select some text in the content above to see rule preview...';
            }
            return;
        }

        const ruleType = document.getElementById('ruleType')?.value || 'regex';
        const ruleName = document.getElementById('ruleName')?.value || 'extractField';
        const mockCoords = { start: 0, end: this.selectedText.length };

        let previewRule = '';
        switch(ruleType) {
            case 'regex':
                const escaped = this.selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                previewRule = `// Regex Rule: ${ruleName}\nstatic extract${ruleName.charAt(0).toUpperCase() + ruleName.slice(1)}(content) {\n    const match = content.match(/${escaped}/);\n    return match ? match[1] || match[0] : '';\n}`;
                break;
            case 'coordinates':
                previewRule = `// Coordinate Rule: ${ruleName}\nstatic extract${ruleName.charAt(0).toUpperCase() + ruleName.slice(1)}(content) {\n    return content.substring(${mockCoords.start}, ${mockCoords.end}).trim();\n}`;
                break;
            case 'xpath':
                previewRule = `// XPath Rule: ${ruleName}\nstatic extract${ruleName.charAt(0).toUpperCase() + ruleName.slice(1)}(content) {\n    const lines = content.split(/[\\r\\n]/);\n    const line = lines.find(l => l.includes("${this.selectedText}"));\n    return line ? line.replace("${this.selectedText}", '').trim() : '';\n}`;
                break;
        }

        const ruleOutput = document.getElementById('ruleOutput');
        if (ruleOutput) {
            ruleOutput.innerHTML = `<strong>Selected: "${this.selectedText}"</strong>\n\n${previewRule}`;
        }
    }

    startFieldEdit(fieldName) {
        const safeFieldName = fieldName.replace(/[^a-zA-Z0-9]/g, '_');
        const valueElement = document.getElementById(`field-val-${safeFieldName}`);
        if (valueElement) {
            valueElement.focus();
            // Select all text
            const range = document.createRange();
            range.selectNodeContents(valueElement);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    // === LIVE MAPPING SYSTEM ===

    // Create live mapping system elements
    createLiveMappingElements() {
        // Create mapping tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'mapping-tooltip';
        tooltip.id = 'mappingTooltip';
        document.body.appendChild(tooltip);

        // Create live mapping indicator
        const indicator = document.createElement('div');
        indicator.className = 'live-mapping-indicator';
        indicator.id = 'liveMappingIndicator';
        indicator.innerHTML = '🔄 LIVE MAPPING ACTIVE';
        document.body.appendChild(indicator);

        // Initialize mapping state
        this.mappingState = {
            activeHighlight: null,
            activeField: null,
            tooltip: tooltip,
            indicator: indicator
        };

        // Add live mapping event handlers
        this.attachLiveMappingHandlers();

        console.log('🔄 Live mapping system initialized');
    }

    // Attach live mapping event handlers
    attachLiveMappingHandlers() {
        const self = this;

        // Handle field card hover/click - bidirectional mapping!
        document.addEventListener('click', function(e) {
            const fieldDiv = e.target.closest('.interactive-field');
            if (fieldDiv) {
                const fieldName = fieldDiv.dataset.field;
                self.handleFieldInteraction(fieldName, e.type === 'click');
                e.stopPropagation();
            }
        });

        // Handle field hover effects
        document.addEventListener('mouseenter', function(e) {
            const fieldDiv = e.target.closest('.interactive-field');
            if (fieldDiv) {
                const fieldName = fieldDiv.dataset.field;
                self.showFieldHover(fieldName);
            }
        });

        document.addEventListener('mouseleave', function(e) {
            const fieldDiv = e.target.closest('.interactive-field');
            if (fieldDiv) {
                const fieldName = fieldDiv.dataset.field;
                self.hideFieldHover(fieldName);
            }
        });

        // Handle highlight click/hover interactions
        document.addEventListener('click', function(e) {
            const highlightSpan = e.target.closest('.extraction-highlight');
            if (highlightSpan) {
                const fieldType = highlightSpan.classList.contains('building-highlight') ? 'building_code' :
                                 highlightSpan.classList.contains('device-highlight') ? 'device_id' : null;
                if (fieldType) {
                    self.handleHighlightInteraction(fieldType, e.type === 'click');
                }
                e.stopPropagation();
            }
        });

        // Handle highlight hover
        document.addEventListener('mouseenter', function(e) {
            const highlightSpan = e.target.closest('.extraction-highlight');
            if (highlightSpan) {
                const fieldType = highlightSpan.classList.contains('building-highlight') ? 'building_code' :
                                 highlightSpan.classList.contains('device-highlight') ? 'device_id' : null;
                if (fieldType) {
                    self.showHighlightHover(fieldType);
                }
            }
        });

        document.addEventListener('mouseleave', function(e) {
            const highlightSpan = e.target.closest('.extraction-highlight');
            if (highlightSpan) {
                const fieldType = highlightSpan.classList.contains('building-highlight') ? 'building_code' :
                                 highlightSpan.classList.contains('device-highlight') ? 'device_id' : null;
                if (fieldType) {
                    self.hideHighlightHover(fieldType);
                }
            }
        });

        // Handle mouse movement for tooltip positioning
        document.addEventListener('mousemove', function(e) {
            self.updateTooltipPosition(e);
        });
    }

    // Handle field interaction (click or hover)
    handleFieldInteraction(fieldName, isClick) {
        if (isClick) {
            // Toggle active field
            if (this.mappingState.activeField === fieldName) {
                this.clearFieldHighlight();
                this.clearHighlightActivation();
            } else {
                this.activateFieldHighlight(fieldName);
                this.activateCorrespondingHighlight(fieldName);
            }
        }

        this.showLiveMappingIndicator();
    }

    // Handle highlight interaction
    handleHighlightInteraction(fieldType, isClick) {
        if (isClick) {
            // Toggle active highlight type
            if (this.mappingState.activeHighlight === fieldType) {
                this.clearFieldHighlight();
                this.clearHighlightActivation();
            } else {
                this.activateFieldHighlight(fieldType);
                this.activateCorrespondingField(fieldType);
            }
        }

        this.showLiveMappingIndicator();
    }

    // Show field hover state
    showFieldHover(fieldName) {
        const fieldDiv = document.querySelector(`.interactive-field[data-field="${fieldName}"]`);
        if (fieldDiv) {
            fieldDiv.style.borderColor = 'var(--accent-color)';
            fieldDiv.style.transform = 'translateY(-1px)';
        }
    }

    // Hide field hover state
    hideFieldHover(fieldName) {
        const fieldDiv = document.querySelector(`.interactive-field[data-field="${fieldName}"]`);
        if (fieldDiv) {
            fieldDiv.style.borderColor = '';
            fieldDiv.style.transform = '';
        }
    }

    // Show highlight hover state
    showHighlightHover(fieldType) {
        const highlightClass = fieldType === 'building_code' ? '.building-highlight' : '.device-highlight';
        const highlights = document.querySelectorAll(`.extraction-highlight${highlightClass}`);
        highlights.forEach(highlight => {
            highlight.classList.add('active');
        });
    }

    // Hide highlight hover state
    hideHighlightHover(fieldType) {
        const highlightClass = fieldType === 'building_code' ? '.building-highlight' : '.device-highlight';
        const highlights = document.querySelectorAll(`.extraction-highlight${highlightClass}`);
        highlights.forEach(highlight => {
            highlight.classList.remove('active');
        });
    }

    // Activate field highlight
    activateFieldHighlight(fieldName) {
        // Clear previous field highlight
        this.clearFieldHighlight();
        this.clearHighlightActivation();

        const fieldDiv = document.querySelector(`.interactive-field[data-field="${fieldName}"]`);
        if (fieldDiv) {
            fieldDiv.classList.add('field-active');
            this.mappingState.activeField = fieldName;
        }

        this.updateTooltip(`${fieldName} field active`);
    }

    // Activate corresponding highlight
    activateCorrespondingHighlight(fieldName) {
        this.clearHighlightActivation();

        let highlightClass;
        if (fieldName === 'building_code') {
            highlightClass = '.building-highlight';
        } else if (fieldName === 'device_id') {
            highlightClass = '.device-highlight';
        }

        if (highlightClass) {
            const highlights = document.querySelectorAll(`.extraction-highlight${highlightClass}`);
            highlights.forEach(highlight => {
                highlight.classList.add('active');
            });
            this.mappingState.activeHighlight = fieldName;
        }
    }

    // Activate corresponding field from highlight
    activateCorrespondingField(fieldType) {
        this.clearFieldHighlight();

        const fieldDiv = document.querySelector(`.interactive-field[data-field="${fieldType}"]`);
        if (fieldDiv) {
            fieldDiv.classList.add('field-active');
            this.mappingState.activeField = fieldType;
        }
    }

    // Clear all field highlights
    clearFieldHighlight() {
        const activeFields = document.querySelectorAll('.interactive-field.field-active');
        activeFields.forEach(field => {
            field.classList.remove('field-active');
        });
        this.mappingState.activeField = null;
    }

    // Clear all highlight activations
    clearHighlightActivation() {
        const activeHighlights = document.querySelectorAll('.extraction-highlight.active');
        activeHighlights.forEach(highlight => {
            highlight.classList.remove('active');
        });
        this.mappingState.activeHighlight = null;
    }

    // Update tooltip position and content
    updateTooltipPosition(event) {
        const tooltip = this.mappingState.tooltip;
        if (!tooltip.classList.contains('show')) return;

        tooltip.style.left = (event.clientX + 10) + 'px';
        tooltip.style.top = (event.clientY + 10) + 'px';
    }

    // Update tooltip content and show it
    updateTooltip(text) {
        const tooltip = this.mappingState.tooltip;
        tooltip.textContent = text;
        tooltip.classList.add('show');

        // Auto-hide after 3 seconds
        setTimeout(() => {
            tooltip.classList.remove('show');
        }, 3000);
    }

    // Show live mapping indicator
    showLiveMappingIndicator() {
        const indicator = this.mappingState.indicator;
        indicator.classList.add('active');

        // Auto-hide after 5 seconds
        clearTimeout(this.indicatorTimeout);
        this.indicatorTimeout = setTimeout(() => {
            indicator.classList.remove('active');
        }, 5000);
    }

    // Enhanced real interactive content with better mapping support
    createRealInteractiveContentWithMapping(rawContent) {
        // Enhanced content creation with better mapping support
        const contentArray = [];
        const lines = rawContent.split('\n');

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            let line = lines[lineIndex];
            let processedLine = '';

            // Handle building codes with enhanced mapping
            if (this.currentEmail.building_code && line.includes(this.currentEmail.building_code)) {
                const parts = line.split(this.currentEmail.building_code);
                processedLine = parts.join(`<span class="extraction-highlight building-highlight" data-field="building_code" data-line="${lineIndex}" title="Click to highlight Building field: ${this.currentEmail.building_code}">🇧 ${this.currentEmail.building_code}</span>`);
            } else {
                processedLine = line;
            }

            // Handle device IDs with enhanced mapping
            if (this.currentEmail.device_id && processedLine.includes(this.currentEmail.device_id)) {
                const parts = processedLine.split(this.currentEmail.device_id);
                processedLine = parts.join(`<span class="extraction-highlight device-highlight" data-field="device_id" data-line="${lineIndex}" title="Click to highlight Device field: ${this.currentEmail.device_id}">📱 ${this.currentEmail.device_id}</span>`);
            }

            contentArray.push(`<div class="content-line" data-line="${lineIndex}">${processedLine || '\u00A0'}</div>`);
        }

        return `<div class="interactive-content">${contentArray.join('')}</div>`;
    }

    // Add live mapping status display
    createMappingStatusDisplay() {
        if (document.getElementById('mappingStatus')) return;

        const statusDiv = document.createElement('div');
        statusDiv.id = 'mappingStatus';
        statusDiv.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(40, 167, 69, 0.1);
            border: 1px solid rgba(40, 167, 69, 0.3);
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 11px;
            color: #28a745;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        statusDiv.textContent = '🔄 LIVE MAPPING ACTIVE';

        document.body.appendChild(statusDiv);

        // Show initially
        setTimeout(() => {
            statusDiv.style.opacity = '1';
        }, 1000);

        // Hide after 5 seconds
        setTimeout(() => {
            statusDiv.style.opacity = '0';
            setTimeout(() => {
                if (statusDiv.parentNode) {
                    statusDiv.parentNode.removeChild(statusDiv);
                }
            }, 300);
        }, 5000);
    }

    convertContentToDisplayableText(content, filename) {
        try {
            if (typeof content === 'string') {
                // Remove null bytes and control characters (except newlines/tabs)
                return content.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
            } else if (content instanceof ArrayBuffer) {
                // Try different encodings for binary content
                const encodings = ['utf-8', 'iso-8859-1', 'windows-1252', 'utf-16le', 'utf-16be'];

                for (const encoding of encodings) {
                    try {
                        const decoder = new TextDecoder(encoding, { fatal: false });
                        const decoded = decoder.decode(content);

                        // Check if the decoded content looks valid (not all control characters)
                        const printableChars = decoded.replace(/[\x00-\x1F\x7F]/g, '').length;
                        if (printableChars / decoded.length > 0.3) { // At least 30% printable characters
                            return decoded.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
                        }
                    } catch (e) {
                        continue; // Try next encoding
                    }
                }

                // If all encodings fail, show as hex dump in text form
                return this.convertContentToHex(content, filename, true);
            }
        } catch (error) {
            console.warn('Error converting content:', error);
            return `Error displaying content: ${error.message}`;
        }

        return 'Unable to display content as text';
    }

    convertContentToHex(content, filename, asText = false) {
        let buffer;
        if (content instanceof ArrayBuffer) {
            buffer = content;
        } else if (typeof content === 'string') {
            buffer = new TextEncoder().encode(content).buffer;
        } else {
            return 'Cannot convert content to hexadecimal';
        }

        const view = new Uint8Array(buffer);
        const hexLines = [];
        const charsPerLine = 16;

        for (let offset = 0; offset < view.length; offset += charsPerLine) {
            const chunk = view.subarray(offset, offset + charsPerLine);
            const hexRow = [];
            const charRow = [];

            // Hex bytes
            for (let i = 0; i < charsPerLine; i++) {
                if (i < chunk.length) {
                    const byte = chunk[i].toString(16).padStart(2, '0');
                    hexRow.push(byte);
                } else {
                    hexRow.push('  ');
                }
            }

            // Character representation
            for (let i = 0; i < charsPerLine; i++) {
                if (i < chunk.length) {
                    const byte = chunk[i];
                    // Show printable characters, '.' for others
                    charRow.push(byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.');
                } else {
                    charRow.push(' ');
                }
            }

            hexLines.push(`${offset.toString(16).padStart(8, '0')}: ${hexRow.join(' ')}  |${charRow.join('')}|`);
        }

        const result = `Hexadecimal dump of ${filename} (${view.length} bytes):\n\n` + hexLines.join('\n');

        if (asText) {
            return result;
        }

        return result;
    }

    displayParsedResults() {
        const structuredDataDiv = document.getElementById('structuredData');
        const validationInfoDiv = document.getElementById('validationInfo');

        if (!this.currentEmail) {
            structuredDataDiv.innerHTML = '<p>No email parsed</p>';
            validationInfoDiv.innerHTML = '<p>No validation information available</p>';
            return;
        }

        // Display structured data
        let html = '<h4>Parsed Email Data</h4>';
        html += '<pre>' + JSON.stringify(this.currentEmail, null, 2) + '</pre>';
        structuredDataDiv.innerHTML = html;
        structuredDataDiv.style.display = 'block';

        // Display validation information
        const validationResult = this.currentEmail.email_parse_title_validation_status || 'valid';
        html = '<h4>Parse Validation</h4>';

        if (validationResult === 'error' || validationResult === 'warning') {
            const flags = this.currentEmail.email_parse_title_validation_flag || {};
            html += '<div style="color: ' + (validationResult === 'error' ? 'red' : 'orange') + ';">';
            html += '<strong>Status: ' + validationResult.toUpperCase() + '</strong><br>';

            Object.keys(flags).forEach(flagKey => {
                const flag = flags[flagKey];
                html += '<div style="margin: 5px 0; padding: 8px; background: rgba(255,0,0,0.1); border-radius: 4px;">';
                html += '<strong>' + flag.severity.toUpperCase() + ':</strong> ' + flag.message;
                html += '<br><small>Subject: "' + flag.subject_value + '" | Body: "' + flag.body_value + '"</small>';
                html += '</div>';
            });
            html += '</div>';
        } else {
            html += '<div style="color: green;"><strong>Status: VALID</strong></div>';
        }

        validationInfoDiv.innerHTML = html;
        validationInfoDiv.style.display = 'block';
    }

    switchTab(tabName) {
        // Update content tab buttons
        document.querySelectorAll('.content-tab').forEach(button => {
            button.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Get content elements
        const emailContent = document.getElementById('emailContent');
        const displayDiv = document.querySelector('.content-display');
        const mimePreview = document.querySelector('.mime-parts-preview');

        // Clear any existing rich content
        const existingRichContent = displayDiv.querySelector('.unified-inline-view');
        if (existingRichContent) {
            existingRichContent.remove();
        }

        // Handle different tab types
        if (tabName === 'raw') {
            // RAW tab: Show rich inline editing content
            emailContent.style.display = 'none';
            if (mimePreview) mimePreview.style.display = 'none';
            
            if (this.currentEmail && this.rawContent) {
                this.displayUnifiedInteractiveView();
            } else {
                emailContent.style.display = 'block';
                emailContent.value = 'Load an email file to inspect its content...';
            }
        } else if (tabName === 'mime-parts') {
            // MIME parts: Show structured MIME display
            emailContent.style.display = 'none';
            if (mimePreview) {
                mimePreview.style.display = 'block';
                this.displayMimeParts();
            } else {
                this.displayMimeParts();
            }
        } else {
            // Other tabs: Show content in textarea
            emailContent.style.display = 'block';
            if (mimePreview) mimePreview.style.display = 'none';

            // Extract content based on tab
            let displayContent = '';

            switch(tabName) {
                case 'headers':
                    displayContent = this.extractRawHeaders();
                    break;
                case 'body':
                    displayContent = this.extractRawBody();
                    break;
                case 'attachments':
                    displayContent = this.extractRawAttachments();
                    break;
            }

            emailContent.value = displayContent || 'No content available for this view';
        }
    }

    updateWorkflowStep(stepName, status) {
        const stepElement = document.getElementById(`step${stepName.charAt(0).toUpperCase() + stepName.slice(1)}`);

        if (stepElement) {
            // Remove existing status classes
            stepElement.classList.remove('active', 'completed');

            // Apply new status
            if (status === 'active') {
                stepElement.classList.add('active');
                console.log(`Set workflow step ${stepName} to ACTIVE`);
            } else if (status === 'completed') {
                stepElement.classList.add('completed');
                console.log(`Set workflow step ${stepName} to COMPLETED`);
            } else {
                // null or any other value = remove all styling
                console.log(`Cleared workflow step ${stepName} styling`);
            }
        } else {
            console.warn(`Workflow step element not found: step${stepName.charAt(0).toUpperCase() + stepName.slice(1)}`);
        }
    }

    extractHeaders() {
        if (!this.rawContent) return 'No content available';

        const lines = this.rawContent.split('\n');
        const headers = [];
        let inHeaders = true;

        for (const line of lines) {
            if (line.trim() === '') {
                if (!inHeaders) break;
                inHeaders = false;
            }
            if (inHeaders) {
                headers.push(line);
            }
        }

        return headers.join('\n');
    }

    extractBody() {
        if (!this.rawContent) return 'No content available';

        const parts = this.rawContent.split(/\n\s*\n/);
        return parts.slice(1).join('\n\n');
    }

    getAttachmentInfo() {
        // Basic attachment detection - could be enhanced
        if (!this.rawContent) return 'No content available';

        const lines = this.rawContent.split('\n');
        const attachments = [];

        for (const line of lines) {
            if (line.toLowerCase().includes('attachment') ||
                line.toLowerCase().includes('content-disposition')) {
                attachments.push(line);
            }
        }

        return attachments.length > 0 ?
            'Potential Attachments:\n' + attachments.join('\n') :
            'No attachments detected in this email.';
    }

    // Methods that work on the original RAW content (not processed content)

    extractRawHeaders() {
        if (!this.originalContent) {
            return 'No raw content available';
        }

        const fileType = this.currentEmail && this.currentEmail.email_type === 'msg' ? 'MSG' : 'EML';
        let headerContent = `===== ${fileType} HEADERS =====\n\n`;

        // For MSG files, show the compound document structure as headers with explanation
        if (this.currentEmail && this.currentEmail.email_type === 'msg') {
            headerContent += `📁 MSG COMPOUND DOCUMENT STRUCTURE\n`;
            headerContent += `═══════════════════════════════════\n`;
            headerContent += `MSG files use compound document format (*.msg)\n`;
            headerContent += `The structure below is the file's header/metastreams:\n\n`;

            // Show first 300 bytes as hex to show the actual MSG header structure
            if (this.originalContent instanceof ArrayBuffer) {
                const hexPreview = this.convertToHexPreview(this.originalContent, 300);
                headerContent += `0x0000 - 0x012C: Compound Document OLE Header\n`;
                headerContent += hexPreview + `\n`;
            } else {
                headerContent += `(Binary MSG structure - use MIME Parts tab for analysis)\n`;
            }

            // Show any reconstructed email headers
            if (this.currentEmail.email_headers) {
                headerContent += `\n📧 RECONSTRUCTED EMAIL HEADERS\n`;
                headerContent += `═══════════════════════════════\n`;
                Object.entries(this.currentEmail.email_headers).forEach(([key, value]) => {
                    headerContent += `${key}: ${value}\n`;
                });
            }

            return headerContent;
        }

        // For EML and text files, show clean email headers
        const content = (typeof this.originalContent === 'string') ?
            this.originalContent :
            this.convertContentToDisplayableText(this.originalContent, 'raw-headers'); // Light cleaning for headers

        const lines = content.split('\n');
        let inHeaders = true;
        let headerLines = [];

        for (const line of lines) {
            if (inHeaders && line.trim() === '') {
                // First blank line ends headers
                break;
            }

            if (inHeaders) {
                headerLines.push(line);
            }
        }

        headerContent += `📧 EMAIL HEADERS\n`;
        headerContent += `═══════════════════════════════\n`;

        if (headerLines.length > 0) {
            headerLines.forEach(line => {
                headerContent += line + '\n';
            });
        } else {
            headerContent += 'No header content found in this format\n';
        }

        headerContent += `\n===== END OF HEADERS =====\n`;
        headerContent += `Total header lines: ${headerLines.length}\n`;
        headerContent += `File format: ${fileType}\n`;

        return headerContent;
    }

    extractRawBody() {
        if (!this.originalContent && typeof this.originalContent !== 'string') {
            return 'No raw content available';
        }

        const content = typeof this.originalContent === 'string' ?
            this.originalContent :
            this.convertContentToDisplayableText(this.originalContent, 'raw');

        // If no MIME parts parsed yet, parse them
        if (!this.mimeParts || this.mimeParts.length === 0) {
            this.mimeParts = this.parseMimeParts(content, 'body_extraction');
        }

        // Find the primary text content (prefer text/plain over text/html)
        const primaryTextParts = this.mimeParts.filter(part =>
            part.contentType && part.contentType.startsWith('text/') &&
            !part.isAttachment &&
            part.content &&
            part.content.trim().length > 0
        );

        // Prefer text/plain, fallback to text/html, then any text content
        const preferredPart = primaryTextParts.find(part => part.contentType === 'text/plain') ||
                             primaryTextParts.find(part => part.contentType === 'text/html') ||
                             primaryTextParts[0];

        if (!preferredPart) {
            // Fallback to simple header/body split if no MIME parts found
            const parts = content.split(/\n\s*\n/);
            return parts.length > 1 ? parts.slice(1).join('\n\n').trim() : 'No body content found';
        }

        // Return the decoded content
        return preferredPart.content.trim();
    }

    extractRawAttachments() {
        if (!this.originalContent && typeof this.originalContent !== 'string') {
            return 'No raw content available';
        }

        const content = typeof this.originalContent === 'string' ?
            this.originalContent :
            this.convertContentToDisplayableText(this.originalContent, 'raw');

        const lines = content.split('\n');
        const attachments = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.toLowerCase().includes('content-disposition') &&
                line.toLowerCase().includes('attachment')) {
                // Found attachment header, collect related info
                attachments.push(`--- Attachment Found at Line ${i + 1} ---`);
                attachments.push(line);

                // Look for filename and related headers
                let j = i + 1;
                while (j < lines.length && j < i + 10) { // Check next 10 lines
                    const nextLine = lines[j];
                    if (nextLine.trim() === '') break; // Empty line ends headers
                    if (nextLine.match(/^(content-|filename)/i)) {
                        attachments.push(nextLine);
                    }
                    j++;
                }
                attachments.push(''); // Empty line after attachment info
            }
        }

        return attachments.length > 0 ?
            'Raw Attachment Information:\n' + attachments.join('\n') :
            'No attachments found in raw content.';
    }

    displayStructuredRawContent() {
        if (!this.originalContent) {
            return 'No raw content available';
        }

        const fileType = this.currentEmail && this.currentEmail.email_type === 'msg' ? 'MSG' : 'EML';
        let structuredContent = `===== ${fileType} RAW CONTENT STRUCTURE =====\n\n`;

        // For binary MSG files, show the raw structure as-is (this IS the format!)
        if (this.currentEmail && this.currentEmail.email_type === 'msg') {
            const rawLines = this.originalContent instanceof ArrayBuffer ?
                this.convertToHexPreview(this.originalContent, 200) : // Show first 200 bytes as hex
                this.originalContent.substring(0, 1000).split('\n').slice(0, 50); // Show first 50 text lines

            structuredContent += `📁 MSG FILE HEADER STRUCTURE (First 200 bytes - actual file format!)\n`;
            structuredContent += `═══════════════════════════════════════════════════════════════\n`;

            if (this.originalContent instanceof ArrayBuffer) {
                structuredContent += `Hex dump of MSG compound document header:\n`;
                structuredContent += rawLines;
            } else {
                structuredContent += `MSG content structure markers (this is NOT garbage - it's the file format!):\n`;
                rawLines.forEach((line, i) => {
                    if (line.trim()) {
                        structuredContent += `${i + 1}: ${line}\n`;
                    }
                });
            }

            structuredContent += `\n📝 PARSED MESSAGE CONTENT\n`;
            structuredContent += `═══════════════════════════════\n`;
            structuredContent += `Subject: ${this.currentEmail.job_name}\n`;
            structuredContent += `Building: ${this.currentEmail.building_code}\n`;
            structuredContent += `Device: ${this.currentEmail.device_id}\n\n`;

            const bodyContent = this.currentEmail.job_trouble_description || this.currentEmail.job_description || 'No body content';
            structuredContent += `Message Body:\n${bodyContent}\n\n`;

            structuredContent += `===== MSG FILE ANALYSIS =====\n`;
            structuredContent += `MSG files use compound document format (*.msg)\n`;
            structuredContent += `The "garbage" above is the file's header structure\n`;
            structuredContent += `Parsed content extracted successfully ✓\n\n`;

            return structuredContent;
        }

        // For EML and text files, show cleaner structure
        const content = (typeof this.originalContent === 'string') ?
            this.originalContent :
            this.convertContentToDisplayableText(this.originalContent, 'raw-light'); // Light cleaning

        const lines = content.split('\n');
        let inHeaders = true;
        let headerCount = 0;
        let bodyCount = 0;

        structuredContent += '[COLLAPSED] 📧 EMAIL HEADERS\n';
        structuredContent += '═══════════════════════════════════════\n';

        // Process first 100 lines for headers and beginning of body
        for (let i = 0; i < Math.min(lines.length, 100); i++) {
            const line = lines[i];

            if (inHeaders && line.trim() === '') {
                // First blank line ends headers
                structuredContent += '\nEnd of headers - Body starts below\n\n';
                structuredContent += '[COLLAPSED] 📝 MESSAGE BODY\n';
                structuredContent += '═══════════════════════════════════════\n';
                inHeaders = false;
                continue;
            }

            if (inHeaders) {
                structuredContent += line + '\n';
                headerCount++;
            } else {
                structuredContent += line + '\n';
                bodyCount++;
            }

            if (!inHeaders && bodyCount >= 20) {
                break; // Stop after 20 body lines
            }
        }

        if (lines.length > (headerCount + bodyCount)) {
            structuredContent += `\n[... ${lines.length - (headerCount + bodyCount)} more lines truncated for display ...]\n`;
            structuredContent += 'Use "BODY" tab for complete message content\n';
        }

        structuredContent += `\n===== FILE ANALYSIS =====\n`;
        structuredContent += `Total lines: ${lines.length}\n`;
        structuredContent += `Headers: ${headerCount} lines\n`;
        structuredContent += `Body preview: ${bodyCount} lines\n`;
        structuredContent += `File type: ${fileType} format\n`;

        structuredContent += '\n===== END OF STRUCTURED RAW CONTENT =====';

        return structuredContent;
    }

    // Create hex preview for binary MSG files
    convertToHexPreview(arrayBuffer, maxBytes = 200) {
        const view = new Uint8Array(arrayBuffer.slice(0, Math.min(arrayBuffer.byteLength, maxBytes)));
        const lines = [];
        const bytesPerLine = 16;

        for (let offset = 0; offset < view.length; offset += bytesPerLine) {
            const chunk = view.subarray(offset, offset + bytesPerLine);
            const hexParts = [];
            const charParts = [];

            for (let i = 0; i < bytesPerLine; i++) {
                if (i < chunk.length) {
                    hexParts.push(chunk[i].toString(16).padStart(2, '0'));
                    charParts.push(chunk[i] >= 32 && chunk[i] <= 126 ? String.fromCharCode(chunk[i]) : '.');
                } else {
                    hexParts.push('  ');
                    charParts.push(' ');
                }
            }

            lines.push(`${offset.toString(16).padStart(8, '0')}: ${hexParts.join(' ')}  |${charParts.join('')}|`);
        }

        lines.push(`\n[... ${arrayBuffer.byteLength - maxBytes} more bytes in file ...]`);

        return lines.join('\n');
    }

    displayParsedEmailStructure() {
        if (!this.currentEmail) {
            return 'No parsed email data available';
        }

        let content = '===== PARSED EMAIL STRUCTURE =====\n\n';

        // Subject
        content += `📧 SUBJECT: ${this.currentEmail.job_name || this.currentEmail.subject || 'No subject'}\n\n`;

        // Headers
        content += '[COLLAPSED] 📧 EMAIL HEADERS\n';
        content += '═══════════════════════════════════════\n';
        if (this.currentEmail.email_headers) {
            for (const [key, value] of Object.entries(this.currentEmail.email_headers)) {
                content += `${key}: ${value}\n`;
            }
        }

        // Body
        content += '\n[COLLAPSED] 📝 MESSAGE BODY\n';
        content += '═══════════════════════════════════════\n';
        content += this.extractRawBody();

        // Attachments
        if (this.attachments && this.attachments.length > 0) {
            content += '\n[COLLAPSED] 📎 ATTACHMENTS\n';
            content += '═══════════════════════════════════════\n';
            this.attachments.forEach(attachment => {
                content += `- ${attachment.filename} (${attachment.size} bytes)\n`;
            });
        }

        content += '\n===== END OF PARSED STRUCTURE =====';
        return content;
    }

    // Extract clean email headers from parsed email data (especially for MSG files)
    extractHeadersFromParsed(parsedEmail) {
        const headers = {};

        // Extract subject
        if (parsedEmail.job_name || parsedEmail.subject) {
            headers['subject'] = parsedEmail.job_name || parsedEmail.subject;
        }

        // For MSG files, we can reconstruct basic email headers from parsed data
        if (parsedEmail.email_type === 'msg') {
            // Basic MSG headers we can infer
            headers['content-type'] = 'multipart/mixed; boundary="----=_NextPart_000_0000"'; // Default MSG structure
            headers['mime-version'] = '1.0';
            headers['date'] = 'Mon, 01 Jan 2024 12:00:00 +0000'; // Placeholder - could be extracted from MSG data

            // Recipient information (from the concatenated UTF8/UTF16 string that shows recipients)
            if (parsedEmail.address) {
                headers['to'] = parsedEmail.address;
            } else {
                headers['to'] = 'recipient@example.com'; // Placeholder
            }

            headers['from'] = 'sender@example.com'; // Placeholder - could be extracted

            // Add additional MSG-specific headers
            headers['content-class'] = 'urn:content-classes:message';
            headers['importance'] = 'normal';
            headers['priority'] = 'normal';
        } else {
            // EML files - basic headers
            headers['content-type'] = 'text/plain; charset=UTF-8';
            headers['mime-version'] = '1.0';
        }

        return headers;
    }

    // Helper function to check if content appears to be binary
    checkIfBinaryContent(content) {
        // Check for excessive null bytes or non-printable characters
        const nonPrintable = content.replace(/[\x20-\x7E\r\n\t]/g, '').length;
        return nonPrintable > content.length * 0.3; // More than 30% non-printable
    }

    handleTextSelection() {
        const emailContent = document.getElementById('emailContent');
        const selection = window.getSelection();

        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            this.selectedText = selection.toString().trim();

            if (this.selectedText) {
                // Calculate coordinates relative to text content
                this.selectionCoords = this.getSelectionCoordinates(range, emailContent);
                this.updateSelectionInfo();
            }
        }
    }

    getSelectionCoordinates(range, container) {
        const textContent = container.value;
        const startOffset = this.getCaretPosition(container);

        // For textarea, we'll use a simplified coordinate system
        const lines = textContent.substring(0, startOffset).split('\n');
        const lineNumber = lines.length;
        const charPosition = lines[lines.length - 1].length + 1;

        return {
            start: startOffset,
            end: startOffset + this.selectedText.length,
            line: lineNumber,
            char: charPosition,
            beforeContext: lines.slice(-3).join('\n'),
            afterContext: textContent.substring(startOffset + this.selectedText.length).split('\n').slice(0, 3).join('\n')
        };
    }

    getCaretPosition(element) {
        return element.selectionStart;
    }

    updateSelectionInfo() {
        const selectionInfo = document.getElementById('selectionInfo');
        const selectedTextDiv = document.getElementById('selectedText');
        const coordinatesDiv = document.getElementById('coordinates');

        if (this.selectedText) {
            selectedTextDiv.innerHTML = `<code>"${this.selectedText}"</code>`;
            coordinatesDiv.innerHTML = `
                <strong>Position:</strong> Line ${this.selectionCoords.line}, Char ${this.selectionCoords.char}<br>
                <strong>Text Range:</strong> ${this.selectionCoords.start} - ${this.selectionCoords.end}<br>
                <strong>Context:</strong><br>
                <small>${this.selectionCoords.beforeContext.replace(/\n/g, '<br>')} <span style="background: yellow;">[${this.selectedText}]</span> ${this.selectionCoords.afterContext.replace(/\n/g, '<br>')}</small>
            `;
            selectionInfo.style.display = 'block';

            // Update workflow steps
            this.updateWorkflowStep('select', 'completed');
            this.updateWorkflowStep('generate', 'active');
        } else {
            selectionInfo.style.display = 'none';
        }
    }

    resetSelectionInfo() {
        this.selectedText = '';
        this.selectionCoords = null;
        document.getElementById('selectionInfo').style.display = 'none';
    }

    generateRule() {
        const ruleType = document.getElementById('ruleType').value;
        const ruleName = document.getElementById('ruleName').value;

        if (!this.selectedText) {
            alert('Please select some text first to generate a rule.');
            return;
        }

        if (!ruleName.trim()) {
            alert('Please enter a rule name.');
            return;
        }

        const generator = this.ruleGenerators[ruleType];
        if (generator) {
            const rule = generator(ruleName, this.selectedText, this.selectionCoords);
            this.addRuleToOutput(rule);
        }
    }

    generateRegexRule(name, text, coords) {
        // Escape special regex characters
        const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rule = {
            type: 'regex',
            name: name,
            pattern: escaped,
            description: `Matches: "${text}"`,
            coordinates: coords,
            test: text
        };
        return `// Regex Rule: ${name}\nstatic extract${name.charAt(0).toUpperCase() + name.slice(1)}(content) {\n    const match = content.match(/${escaped}/);\n    return match ? match[1] || match[0] : '';\n}`;
    }

    generateCoordinateRule(name, text, coords) {
        const rule = {
            type: 'coordinates',
            name: name,
            coordinates: coords,
            description: `Extracts text at position ${coords.start} to ${coords.end}`,
            test: text
        };
        return `// Coordinate Rule: ${name}\nstatic extract${name.charAt(0).toUpperCase() + name.slice(1)}(content) {\n    return content.substring(${coords.start}, ${coords.end}).trim();\n}`;
    }

    generateCSSRule(name, text, coords) {
        // CSS selectors are not really applicable to text content, but we can simulate
        const rule = {
            type: 'css',
            name: name,
            selector: `[data-content*="${text.substring(0, 20)}"]`, // Simulate CSS selector
            description: `CSS selector-style extraction for: "${text}"`,
            test: text
        };
        return `// CSS Selector Rule: ${name}\nstatic extract${name.charAt(0).toUpperCase() + name.slice(1)}(content) {\n    // CSS selector simulation\n    if (content.includes("${text}")) {\n        const parts = content.split("${text}");\n        return parts[1] ? parts[1].split(/[\\r\\n]/)[0].trim() : "${text}";\n    }\n    return '';\n}`;
    }

    generateXPathRule(name, text, coords) {
        const rule = {
            type: 'xpath',
            name: name,
            xpath: `//text()[contains(., "${text}")]`,
            description: `XPath-style extraction for: "${text}"`,
            test: text
        };
        return `// XPath Rule: ${name}\nstatic extract${name.charAt(0).toUpperCase() + name.slice(1)}(content) {\n    // XPath simulation - find content containing "${text}"\n    const lines = content.split(/[\\r\\n]/);\n    const line = lines.find(l => l.includes("${text}"));\n    return line ? line.replace("${text}", '').trim() : '';\n}`;
    }

    addRuleToOutput(ruleCode) {
        const ruleOutput = document.getElementById('ruleOutput');
        const currentContent = ruleOutput.innerHTML;

        const newContent = currentContent === '// Generated rules will appear here...' ?
            ruleCode :
            currentContent + '\n\n' + ruleCode;

        ruleOutput.innerHTML = newContent;

        // Update workflow steps
        this.updateWorkflowStep('generate', 'completed');
        this.updateWorkflowStep('integrate', 'active');
    }

    copyRules() {
        const ruleOutput = document.getElementById('ruleOutput');
        const rules = ruleOutput.innerHTML;

        if (rules === '// Generated rules will appear here...') {
            alert('No rules generated yet. Please select text and generate some rules first.');
            return;
        }

        navigator.clipboard.writeText(rules).then(() => {
            alert('Rules copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy rules:', err);
            alert('Failed to copy rules to clipboard.');
        });
    }

    testWithParser() {
        if (!this.currentEmail) {
            alert('No email parsed yet. Please load an email file first.');
            return;
        }

        // Update workflow steps
        this.updateWorkflowStep('integrate', 'completed');

        // Test the current email with the parser and show extended validation
        const testResult = this.extendedValidation();

        const resultWindow = window.open('', '_blank');
        resultWindow.document.write(`
            <html>
            <head>
                <title>Parser Test Results - ${this.currentEmail.job_name}</title>
                <style>
                    body { font-family: monospace; padding: 20px; }
                    .success { color: green; }
                    .error { color: red; }
                    .warning { color: orange; }
                    pre { background: #f5f5f5; padding: 10px; border-radius: 4px; }
                </style>
            </head>
            <body>
                <h1>E-mail Parser Test Results</h1>
                <h2>Subject: ${this.currentEmail.job_name}</h2>
                <div class="validation-result">
                    <h3>Validation Status: <span class="${testResult.validationClass}">${testResult.validationStatus}</span></h3>
                    ${testResult.validationDetails}
                </div>
                <div class="extracted-data">
                    <h3>Extracted Data</h3>
                    <pre>${JSON.stringify(testResult.extractedData, null, 2)}</pre>
                </div>
                <div class="debug-info">
                    <h3>Debug Information</h3>
                    <pre>${testResult.debugInfo}</pre>
                </div>
            </body>
            </html>
        `);
    }

    // Send parsed email data to Work Management System
    sendToWorkManagementSystem() {
        if (!this.currentEmail) {
            alert('No email parsed yet. Please load an email file first.');
            return;
        }

        try {
            // Prepare data for WMS
            const wmsData = this.prepareDataForWMS();

            // Store in localStorage for WMS to pick up
            localStorage.setItem('emailInspectorData', JSON.stringify(wmsData));
            
            // Open WMS in new tab/window
            const wmsWindow = window.open('workManagementSystem.html', 'wms_window');
            
            // Send data via postMessage when window loads
            wmsWindow.onload = () => {
                wmsWindow.postMessage({
                    type: 'EMAIL_IMPORT_DATA',
                    data: wmsData
                }, '*');
            };

            // Show success message
            this.showSuccessMessage('Email data sent to Work Management System!');
            
            console.log('📤 Email data sent to WMS:', wmsData);

        } catch (error) {
            console.error('❌ Failed to send data to WMS:', error);
            alert('Failed to send data to Work Management System: ' + error.message);
        }
    }

    // Prepare email data for Work Management System format
    prepareDataForWMS() {
        const today = new Date().toISOString().split('T')[0];
        const currentTime = new Date().toTimeString().split(' ')[0];

        return {
            // Job Information
            job_name: this.currentEmail.job_name || '',
            job_number: this.currentEmail.job_number || `AUTO-${Date.now()}`,
            building_code: this.currentEmail.building_code || '',
            building_address: this.currentEmail.building_address || '',
            
            // Device Information
            device_id: this.currentEmail.device_id || '',
            device_type: this.currentEmail.device_type || '',
            
            // Schedule (default to today)
            job_start_date: today,
            job_start_time: '08:00',
            job_end_time: '17:00',
            
            // Problem Details
            job_trouble_description: this.currentEmail.job_trouble_description || this.currentEmail.job_description || '',
            job_trouble_type: this.extractTroubleType(this.currentEmail.job_trouble_description || ''),
            
            // Status & Dispatch
            job_dispatch_type: 'Spontaneous', // Default for email imports
            job_field_status: 'pending',
            job_followup_required: 'yes',
            
            // Work Description (placeholder)
            job_work_description: 'Work performed will be documented here.',
            
            // Additional fields from email
            job_device_details: this.currentEmail.device_details || '',
            related_tickets: this.currentEmail.related_tickets || '',
            
            // Email parsing metadata
            email_source: this.currentEmail.email_source || 'EmailInspector',
            email_parse_validation_status: this.currentEmail.email_parse_title_validation_status || 'valid',
            email_parse_validation_flags: this.currentEmail.email_parse_title_validation_flag || {},
            
            // Import timestamp
            imported_at: new Date().toISOString(),
            import_source: 'Email Inspector Tool'
        };
    }

    // Extract trouble type from description text
    extractTroubleType(description) {
        const desc = description.toLowerCase();
        if (desc.includes('device offline') || desc.includes('offline')) return 'DFO';
        if (desc.includes('line error') || desc.includes('error')) return 'line error';
        if (desc.includes('malfunction') || desc.includes('fault')) return 'malfunction';
        return 'other';
    }

    // Show success message to user
    showSuccessMessage(message) {
        // Create temporary success notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: bold;
            max-width: 350px;
        `;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">✅</span>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
    }

    extendedValidation() {
        const result = {
            validationStatus: 'valid',
            validationClass: 'success',
            validationDetails: '',
            extractedData: this.currentEmail,
            debugInfo: ''
        };

        if (this.currentEmail.email_parse_title_validation_status === 'error') {
            result.validationStatus = 'error';
            result.validationClass = 'error';
        } else if (this.currentEmail.email_parse_title_validation_status === 'warning') {
            result.validationStatus = 'warning';
            result.validationClass = 'warning';
        }

        const flags = this.currentEmail.email_parse_title_validation_flag || {};
        result.validationDetails = '<ul>';
        Object.keys(flags).forEach(key => {
            const flag = flags[key];
            result.validationDetails += `<li class="${flag.severity}"><strong>${flag.severity.toUpperCase()}:</strong> ${flag.message}</li>`;
        });
        result.validationDetails += '</ul>';

        // Add debug information
        const parsedOriginal = this.currentEmail;
        const originalSubject = this.extractSubjectLine();
        const bodyContent = this.extractBody();

        result.debugInfo = `Subject Line: "${originalSubject}"\n\nBody Preview (first 200 chars):\n${bodyContent.substring(0, 200)}\n\nParsed job_name: "${parsedOriginal.job_name}"\nParsed building: "${parsedOriginal.building_code}"\nParsed device: "${parsedOriginal.device_id}"`;

        return result;
    }

    extractSubjectLine() {
        const content = document.getElementById('emailContent').value;
        const lines = content.split('\n');
        for (const line of lines) {
            if (line.toLowerCase().startsWith('subject:')) {
                return line.substring(8).trim();
            }
        }
        return '';
    }

    parseMimeParts(content, filename) {
        try {
            const parts = [];
            let currentPart = null;
            let inHeaders = false;
            let contentType = 'text/plain';
            let boundary = null;

            // Try to detect MIME structure
            const textContent = this.convertContentToDisplayableText(content, filename);
            const lines = textContent.split('\n');

            // Look for Content-Type header to detect if this is a multipart email
            const contentTypeLine = lines.find(line => line.toLowerCase().startsWith('content-type:'));
            if (contentTypeLine) {
                contentType = contentTypeLine.substring(13).trim();
                const boundaryMatch = contentType.match(/boundary="([^"]+)"/) || contentType.match(/boundary=([^;\s]+)/);
                if (boundaryMatch) {
                    boundary = boundaryMatch[1];
                }
            }

            if (boundary && contentType.includes('multipart/')) {
                // Parse multipart MIME structure
                const boundaryLine = `--${boundary}`;
                let currentPos = 0;

                while (currentPos < lines.length) {
                    const lineIndex = lines.findIndex((line, idx) => idx >= currentPos && line.trim() === boundaryLine);
                    if (lineIndex === -1) break;

                    const partStart = lineIndex;
                    let partEnd = lines.length;

                    // Find next boundary
                    for (let i = partStart + 1; i < lines.length; i++) {
                        if (lines[i].trim() === boundaryLine || lines[i].trim() === `${boundaryLine}--`) {
                            partEnd = i;
                            break;
                        }
                    }

                    const partLines = lines.slice(partStart + 1, partEnd);
                    const part = this.parseMimePart(partLines, partStart);

                    if (part) {
                        parts.push(part);
                    }

                    currentPos = partEnd + 1;
                }
            } else {
                // Single part email
                parts.push({
                    index: 0,
                    contentType: contentType || 'text/plain',
                    headers: {},
                    content: textContent,
                    size: textContent.length,
                    isText: true,
                    isBinary: false,
                    canDownload: false,
                    filename: null
                });
            }

            return parts;
        } catch (error) {
            console.warn('MIME parsing error:', error);
            return [{
                index: 0,
                contentType: 'text/plain',
                headers: {},
                content: this.convertContentToDisplayableText(content, filename),
                size: content.length || content.byteLength,
                isText: true,
                isBinary: false,
                canDownload: false,
                filename: null,
                error: true
            }];
        }
    }

    parseMimePart(lines, lineStart) {
        const headers = {};
        let contentStart = 0;
        let inHeaders = true;
        let contentType = 'text/plain';
        let filename = null;
        let contentId = null;
        let transferEncoding = null;
        let isAttachment = false;

        // Parse headers
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.trim() === '') {
                // End of headers
                contentStart = i + 1;
                break;
            }

            if (line.includes(':')) {
                const [headerName, ...headerValueParts] = line.split(':');
                const headerValue = headerValueParts.join(':').trim();

                if (headerName.toLowerCase() === 'content-type') {
                    contentType = headerValue;
                    const filenameMatch = headerValue.match(/filename="([^"]+)"/) || headerValue.match(/filename=([^;\s]+)/);
                    if (filenameMatch) {
                        filename = filenameMatch[1];
                        isAttachment = true;
                    }
                } else if (headerName.toLowerCase() === 'content-disposition') {
                    const filenameMatch = headerValue.match(/filename="([^"]+)"/) || headerValue.match(/filename=([^;\s]+)/);
                    if (filenameMatch) {
                        filename = filenameMatch[1];
                        isAttachment = true;
                    }
                } else if (headerName.toLowerCase() === 'content-id') {
                    contentId = headerValue.replace(/[<>]/g, '');
                } else if (headerName.toLowerCase() === 'content-transfer-encoding') {
                    transferEncoding = headerValue;
                }

                headers[headerName.toLowerCase()] = headerValue;
            }
        }

        const contentLines = lines.slice(contentStart);
        let content = contentLines.join('\n');

        // Decode transfer encoding if needed
        if (transferEncoding === 'base64') {
            try {
                content = atob(content.replace(/\s/g, ''));
            } catch (e) {
                content = `BASE64 decoding error: ${e.message}`;
            }
        } else if (transferEncoding === 'quoted-printable') {
            content = this.decodeQuotedPrintable(content);
        }

        const isText = contentType.startsWith('text/');
        const isBinary = !isText;

        return {
            index: lineStart,
            contentType: contentType,
            headers: headers,
            content: content,
            size: content.length,
            isText: isText,
            isBinary: isBinary,
            canDownload: isBinary || isAttachment,
            filename: filename,
            contentId: contentId,
            transferEncoding: transferEncoding,
            isAttachment: isAttachment
        };
    }

    decodeQuotedPrintable(input) {
        try {
            return input
                .replace(/=\r?\n/g, '') // Remove soft line breaks
                .replace(/=([0-9A-F]{2})/gi, (match, hex) => {
                    return String.fromCharCode(parseInt(hex, 16));
                });
        } catch (error) {
            console.warn('Quoted-printable decoding error:', error);
            return input;
        }
    }

    displayMimeParts() {
        const emailContent = document.getElementById('emailContent');

        if (!this.mimeParts || this.mimeParts.length === 0) {
            emailContent.value = 'No MIME parts detected. The email may be a simple text message.';
            return;
        }

        let html = `<div class="mime-parts-container">
            <h3>📧 Email Structure: ${this.mimeParts.length} MIME Part${this.mimeParts.length !== 1 ? 's' : ''}</h3>
            <div class="mime-parts-list">`;

        this.mimeParts.forEach((part, index) => {
            const contentTypeIcon = this.getContentTypeIcon(part.contentType);
            const sizeKb = (part.size / 1024).toFixed(1);
            const className = part.isBinary ? 'binary-part' : 'text-part';
            const contentPreview = part.isText ?
                part.content.substring(0, 200).replace(/\n/g, ' ').trim() + (part.content.length > 200 ? '...' : '') :
                '[Binary content - click to expand]';

            html += `<div class="mime-part ${className}" data-part-index="${index}">
                <div class="mime-part-header">
                    <span class="mime-toggle">▶️</span>
                    <span class="mime-icon">${contentTypeIcon}</span>
                    <span class="mime-content-type">${part.contentType}</span>
                    <span class="mime-size">${sizeKb} KB</span>`;
            if (part.canDownload && part.filename) {
                html += `<button class="download-btn" data-part-index="${index}">💾 ${part.filename}</button>`;
            }
            html += `</div>
                <div class="mime-part-content" style="display: none;">
                    <div class="mime-part-meta">
                        ${part.filename ? `<strong>Filename:</strong> ${part.filename}<br>` : ''}
                        ${part.contentId ? `<strong>Content-ID:</strong> ${part.contentId}<br>` : ''}
                        ${part.transferEncoding ? `<strong>Transfer Encoding:</strong> ${part.transferEncoding}<br>` : ''}
                        <strong>Size:</strong> ${part.size} characters
                    </div>
                    <div class="mime-part-preview">
                        <pre>${contentPreview}</pre>
                    </div>
                </div>
            </div>`;
        });

        html += `</div></div>`;

        emailContent.value = 'Loading MIME parts display...';
        emailContent.style.display = 'none';

        // Insert HTML after the textarea
        const displayDiv = document.querySelector('.content-display');
        if (displayDiv) {
            // Remove existing MIME parts if any
            const existingMime = displayDiv.querySelector('.mime-parts-preview');
            if (existingMime) {
                existingMime.remove();
            }

            const mimePreviewDiv = document.createElement('div');
            mimePreviewDiv.className = 'mime-parts-preview';
            mimePreviewDiv.innerHTML = html;
            displayDiv.appendChild(mimePreviewDiv);
        }
    }

    getContentTypeIcon(contentType) {
        if (contentType.startsWith('text/')) {
            if (contentType.includes('html')) return '🎨';
            return '📄';
        }
        if (contentType.startsWith('image/')) return '🖼️';
        if (contentType.startsWith('audio/')) return '🔊';
        if (contentType.startsWith('video/')) return '🎥';
        if (contentType.startsWith('application/pdf')) return '📕';
        if (contentType.startsWith('application/')) return '💼';
        return '📎';
    }

    toggleMimePart(buttonElement) {
        const partElement = buttonElement.closest('.mime-part');
        const contentElement = partElement.querySelector('.mime-part-content');

        if (contentElement.style.display === 'none') {
            contentElement.style.display = 'block';
            buttonElement.textContent = '🔽';
        } else {
            contentElement.style.display = 'none';
            buttonElement.textContent = '▶️';
        }
    }

    downloadMimePart(partIndex) {
        const part = this.mimeParts[partIndex];
        if (!part) return;

        // For binary content, we'd need to reconstruct the original binary data
        // For now, we'll handle text parts or simple downloads
        if (part.isText) {
            const blob = new Blob([part.content], { type: part.contentType });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = part.filename || `part_${partIndex}.${part.contentType.split('/')[1]}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            URL.revokeObjectURL(url);
        } else {
            // For binary parts, show an alert since we need more complex handling
            alert(`Binary download for "${part.filename}" requires additional implementation. Content-Type: ${part.contentType}`);
        }
    }

    showError(message) {
        const statusElement = document.createElement('div');
        statusElement.style.cssText = 'position: fixed; top: 20px; right: 20px; background: red; color: white; padding: 10px; border-radius: 4px; z-index: 1000;';
        statusElement.textContent = message;

        document.body.appendChild(statusElement);
        setTimeout(() => document.body.removeChild(statusElement), 5000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.emailInspector = new EmailInspector();

    // Reset all form elements to their default state
    resetUIElements();
});

function resetUIElements() {
    // Clear email content textarea
    const emailContent = document.getElementById('emailContent');
    if (emailContent) {
        emailContent.value = 'Load an email file to inspect its content...';
        emailContent.style.display = 'block';
    }

    // Clear file info
    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo) {
        fileInfo.innerHTML = 'No file loaded';
    }

    // Clear parsed results
    const structuredData = document.getElementById('structuredData');
    const validationInfo = document.getElementById('validationInfo');
    if (structuredData) {
        structuredData.innerHTML = '';
        structuredData.style.display = 'none';
    }
    if (validationInfo) {
        validationInfo.innerHTML = '';
        validationInfo.style.display = 'none';
    }

    // Clear selection info
    const selectionInfo = document.getElementById('selectionInfo');
    if (selectionInfo) {
        selectionInfo.style.display = 'none';
    }

    // Reset form inputs
    const ruleType = document.getElementById('ruleType');
    const ruleName = document.getElementById('ruleName');
    if (ruleType) ruleType.value = 'regex';
    if (ruleName) ruleName.value = '';

    // Clear rule output
    const ruleOutput = document.getElementById('ruleOutput');
    if (ruleOutput) {
        ruleOutput.innerHTML = '// Generated rules will appear here...';
    }

    // Reset workflow steps
    ['upload', 'inspect', 'select', 'generate', 'integrate'].forEach(step => {
        const stepElement = document.getElementById(`step${step.charAt(0).toUpperCase() + step.slice(1)}`);
        if (stepElement) {
            stepElement.classList.remove('active', 'completed');
            if (step === 'upload') {
                stepElement.classList.add('active'); // Upload step starts active
            }
        }
    });

    // Reset tab selection
    document.querySelectorAll('.content-tab').forEach(button => {
        button.classList.remove('active');
        if (button.dataset.tab === 'raw') {
            button.classList.add('active'); // Raw tab starts active
        }
    });

    // Clear any MIME parts preview
    const mimePreview = document.querySelector('.mime-parts-preview');
    if (mimePreview) {
        mimePreview.remove();
    }

    // Clear drop zone state
    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
        dropZone.classList.remove('dragover', 'processing');
    }
}
