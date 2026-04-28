import { skillRegistry } from './registry.js';
import { readFile } from 'fs/promises';
export async function loadSkillContent(skillId) {
    const skill = skillRegistry.get(skillId);
    if (!skill)
        return null;
    try {
        const content = await readFile(skill.path, 'utf-8');
        return content;
    }
    catch {
        return null;
    }
}
export function getSkillPrompt(skillId, taskContext) {
    const skill = skillRegistry.get(skillId);
    if (!skill)
        return '';
    return `\n\n## SKILL: ${skill.name}\n\n` +
        `**Trigger Phrases:** ${skill.triggerPhrases.join(', ')}\n\n` +
        `**Description:** ${skill.description}\n\n` +
        `**Task Context:** ${taskContext}\n\n` +
        `**Skill File:** ${skill.path}\n\n` +
        `Load this skill using the Skill tool to activate its capabilities.`;
}
