/**
 * OpenCode code generation using the HTTP API.
 */
import { sendToOpencodeServer } from './opencode-client.js';
/**
 * Extract JSON payload from OpenCode response.
 */
function extractJsonPayload(content) {
    // Try to extract JSON object from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        return jsonMatch[0];
    }
    return content;
}
/**
 * Parse code generation result from JSON response.
 */
function parseCodeResult(content) {
    try {
        const jsonString = extractJsonPayload(content);
        const parsed = JSON.parse(jsonString);
        return {
            success: true,
            code: typeof parsed.code === 'string' ? parsed.code : content,
            summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
            notes: Array.isArray(parsed.notes) ? parsed.notes.filter((n) => typeof n === 'string') : undefined,
        };
    }
    catch {
        // If parsing fails, return the content as code
        return {
            success: true,
            code: content,
        };
    }
}
/**
 * Generate code for a blueprint node using OpenCode.
 */
export async function generateNodeCode(options) {
    const { systemPrompt, userPrompt, timeout } = options;
    const fullPrompt = `${systemPrompt}

${userPrompt}

Return ONLY valid JSON with the implementation:
{
  "summary": "short description of what was implemented",
  "code": "full implementation code",
  "notes": ["any implementation notes or caveats"]
}`;
    const result = await sendToOpencodeServer(fullPrompt, { timeout });
    if (!result.success) {
        throw new Error(result.error || 'OpenCode generation failed');
    }
    if (!result.content) {
        throw new Error('OpenCode returned empty response');
    }
    const parsed = parseCodeResult(result.content);
    if (!parsed.success || !parsed.code) {
        throw new Error(parsed.error || 'Failed to parse OpenCode response');
    }
    return parsed.code;
}
/**
 * Generate code with full result object (for more detailed responses).
 */
export async function generateNodeCodeDetailed(options) {
    const { systemPrompt, userPrompt, timeout } = options;
    const fullPrompt = `${systemPrompt}

${userPrompt}

Return ONLY valid JSON with the implementation:
{
  "summary": "short description of what was implemented",
  "code": "full implementation code",
  "notes": ["any implementation notes or caveats"]
}`;
    const result = await sendToOpencodeServer(fullPrompt, { timeout });
    if (!result.success || !result.content) {
        return {
            success: false,
            error: result.error || 'OpenCode generation failed',
        };
    }
    return parseCodeResult(result.content);
}
