import { skillRegistry, type SkillEntry } from './registry.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

export async function loadSkillContent(skillId: string): Promise<string | null> {
  const skill = skillRegistry.get(skillId);
  if (!skill) return null;

  try {
    const content = await readFile(skill.path, 'utf-8');
    return content;
  } catch {
    return null;
  }
}

export function getSkillPrompt(skillId: string, taskContext: string): string {
  const skill = skillRegistry.get(skillId);
  if (!skill) return '';

  return '\n\n## SKILL: ${skill.name}\n\n' +
    '**Trigger Phrases:** ${skill.triggerPhrases.join(', ')}\n\n' +
    '**Description:** ${skill.description}\n\n' +
    '**Task Context:** ${taskContext}\n\n' +
    '**Skill File:** ${skill.path}\n\n' +
    'Load this skill using the Skill tool to activate its capabilities.';
}
