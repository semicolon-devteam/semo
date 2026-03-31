/**
 * GFP Bot Dispatch — OpenClaw gateway wrapper for phase-specific bots
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { getPhaseAssignee } from './gfp-phases';

const execAsync = promisify(exec);

export async function dispatchBotMessage(
  botId: string,
  message: string
): Promise<{ sessionKey: string } | null> {
  try {
    const { stdout } = await execAsync(
      `openclaw send --bot ${botId} --json --message ${JSON.stringify(message)}`
    );
    return JSON.parse(stdout);
  } catch (error) {
    console.error(`GFP bot dispatch error (${botId}):`, error);
    return null;
  }
}

export async function dispatchResearch(
  taskId: string,
  botId: string,
  message: string
): Promise<void> {
  await dispatchBotMessage(botId, `[GFP Research Task: ${taskId}]\n\n${message}`);
}

export async function dispatchRegeneration(
  sectionId: string,
  originalContent: string,
  reviewerNote: string,
  phase: number = 0
): Promise<void> {
  const assignee = getPhaseAssignee(phase);
  const message = `[GFP Section Regeneration: ${sectionId}]

## Original Content
${originalContent}

## Rejection Reason
${reviewerNote}

Please regenerate the section addressing the rejection reason above.`;

  await dispatchBotMessage(assignee.botId, message);
}
