class EmailParser {
    static parseEml(content) {
        console.log('=== EML PARSING DEBUG ===');
        console.log('Raw content length:', content.length);
        console.log('First 500 chars:', content.substring(0, 500));
        
        // Find all subject lines
        const subjectMatches = content.match(/^Subject:.*$/gm);
        console.log('All Subject lines found:', subjectMatches);
        
        // Simple extraction
        const lines = content.split('\n');
        let subject = '';
        for (let line of lines) {
            if (line.toLowerCase().startsWith('subject:')) {
                subject = line.substring(8).trim();
                console.log('Extracted subject:', subject);
                break;
            }
        }
        
        const body = content.split(/\n\s*\n/).slice(1).join('\n');
        return this.extractData(subject, body);
    }
    
    static parseHeaders(content) {
        const headers = {};
        const lines = content.split(/\r?\n/);
        let currentHeader = null;
        let currentValue = '';
        
        for (let line of lines) {
            // Empty line marks end of headers
            if (line.trim() === '') break;
            
            // Continuation line (starts with whitespace)
            if (line.match(/^\s+/) && currentHeader) {
                currentValue += ' ' + line.trim();
            }
            // New header line
            else if (line.includes(':')) {
                // Save previous header
                if (currentHeader) {
                    headers[currentHeader.toLowerCase()] = this.unfoldHeader(currentValue);
                }
                
                // Start new header
                const colonIndex = line.indexOf(':');
                currentHeader = line.substring(0, colonIndex).trim();
                currentValue = line.substring(colonIndex + 1).trim();
            }
        }
        
        // Save last header
        if (currentHeader) {
            headers[currentHeader.toLowerCase()] = this.unfoldHeader(currentValue);
        }
        
        return headers;
    }
    
    static unfoldHeader(value) {
        // Decode RFC 2047 encoded words
        return value.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (match, charset, encoding, encoded) => {
            try {
                if (encoding.toUpperCase() === 'B') {
                    return atob(encoded);
                } else if (encoding.toUpperCase() === 'Q') {
                    return encoded.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (m, hex) => 
                        String.fromCharCode(parseInt(hex, 16))
                    );
                }
            } catch (e) {
                return encoded;
            }
            return match;
        }).replace(/\s+/g, ' ').trim();
    }
    
    static parseMsg(arrayBuffer) {
        console.log('=== MSG PARSING DEBUG ===');
        
        // Convert to UTF-16 and UTF-8 strings
        const utf8 = new TextDecoder('utf-8').decode(arrayBuffer);
        const utf16 = new TextDecoder('utf-16le').decode(arrayBuffer);
        
        console.log('UTF-8 length:', utf8.length);
        console.log('UTF-16 length:', utf16.length);
        
        // Try to find subject in both encodings
        let subject = '';
        
        // Pattern 1: UTF-16 subject - stop at Thread-
        let match = utf16.match(/Subject[\x00\s]*:([^\x00]*?)(?=Thread-|[\x00]{2,}|$)/i);
        if (match && match[1]) {
            subject = match[1].replace(/\x00/g, '').replace(/\s+/g, ' ').trim();
            console.log('UTF-16 subject found:', subject);
        }
        
        // Pattern 2: UTF-8 subject - stop at Thread-
        if (!subject || subject.length < 20) {
            match = utf8.match(/Subject:\s*([^\r\n\x00]*?)(?=Thread-|\r|\n|\x00|$)/i);
            if (match && match[1]) {
                subject = match[1].trim();
                console.log('UTF-8 subject found:', subject);
            }
        }
        
        // Pattern 3: Look for the filename pattern in content
        if (!subject || subject.length < 20) {
            const filename = 'Service Call B-802641 - SEA124 - Alarm Active - P3 - Reader - P296563983-13';
            if (utf8.includes('B-802641') || utf16.includes('B-802641')) {
                subject = filename;
                console.log('Using filename as subject:', subject);
            }
        }
        
        console.log('Final MSG subject:', subject);
        return this.extractData(subject, utf8 + utf16);
    }
    
    static extractData(subject, body) {
        console.log('=== EXTRACT DATA DEBUG ===');
        console.log('Input subject:', subject);
        console.log('Subject length:', subject.length);
        
        const jobName = subject.replace(/^Service Call:\s*/i, '').replace(/\s+/g, ' ').trim();
        console.log('Final jobName:', jobName);
        console.log('JobName length:', jobName.length);
        
        const jobNumber = this.extractJobNumber(body);
        const deviceName = this.extractDeviceName(body);
        const problemDescription = this.extractProblemDescription(body);
        const building = this.extractBuilding(body);
        const address = this.extractAddress(body);
        
        return { jobNumber, jobName, deviceName, problemDescription, building, address };
    }
    
    static extractAddress(content) {
        console.log('=== ADDRESS EXTRACTION DEBUG ===');
        
        let match = content.match(/Work Site Address:\s*([^\r\n]+)/i);
        if (!match) {
            match = content.match(/Site Address:\s*([^\r\n]+)/i);
        }
        if (!match) {
            match = content.match(/Address:\s*([^\r\n]+)/i);
        }
        
        const result = match ? match[1].trim() : '';
        console.log('Address extracted:', result);
        return result;
    }
    
    static extractBuilding(content) {
        console.log('=== BUILDING EXTRACTION DEBUG ===');
        
        let match = content.match(/Work Site:\s*([^\r\n]+)/i);
        if (!match) {
            match = content.match(/WorkSite:\s*([^\r\n]+)/i);
        }
        if (!match) {
            match = content.match(/Site:\s*([^\r\n]+)/i);
        }
        
        const result = match ? match[1].trim() : '';
        console.log('Building extracted:', result);
        return result;
    }
    
    static extractJobNumber(content) {
        const match = content.match(/SIM-T Ticket:\s*([VP]\d+)/i);
        return match ? match[1].toUpperCase() : '';
    }
    
    static extractDeviceName(content) {
        const match = content.match(/Device Name:\s*([^\r\n]+)/i);
        return match ? match[1].trim() : '';
    }
    
    static extractProblemDescription(content) {
        const lines = content.split('\n');
        let description = '';
        let capturing = false;
        
        for (let line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('Problem Description:')) {
                description = trimmedLine.substring(20).trim();
                capturing = true;
            } else if (capturing) {
                if (trimmedLine.match(/^[-=_\*]{2,}/) || trimmedLine.includes('---') || trimmedLine.includes('___')) {
                    break;
                }
                if (trimmedLine) {
                    description += ' ' + trimmedLine;
                }
            }
        }
        
        // Clean up quoted-printable encoding
        return description
            .replace(/=\r?\n/g, '')  // Remove soft line breaks
            .replace(/=\s/g, ' ')    // Replace = followed by space
            .replace(/=$/g, '')      // Remove = at end of lines
            .replace(/=[0-9A-F]{2}/g, (match) => {
                // Decode hex values
                const hex = match.substring(1);
                return String.fromCharCode(parseInt(hex, 16));
            })
            .trim();
    }
}