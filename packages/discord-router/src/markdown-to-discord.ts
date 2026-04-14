/**
 * Discord message utilities.
 *
 * Discord natively renders standard Markdown, so no conversion needed.
 * This module handles message splitting for the 2000-char limit.
 */

const MAX_LENGTH = 2000;

/**
 * Split a message into chunks that fit within Discord's 2000-char limit.
 * Respects code block boundaries and newline breaks.
 */
export function splitDiscordMessage(text: string): string[] {
  if (text.length <= MAX_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline boundary within a reasonable range
    let splitAt = remaining.lastIndexOf('\n', MAX_LENGTH);
    if (splitAt < MAX_LENGTH * 0.5) {
      // No good newline break — try space
      splitAt = remaining.lastIndexOf(' ', MAX_LENGTH);
    }
    if (splitAt < MAX_LENGTH * 0.3) {
      // Still no good break — hard cut
      splitAt = MAX_LENGTH;
    }

    // Check if we're inside a code block — if so, close and re-open
    const chunk = remaining.slice(0, splitAt);
    const openFences = (chunk.match(/```/g) || []).length;
    if (openFences % 2 !== 0) {
      // Unclosed code block — close it in this chunk, re-open in next
      chunks.push(chunk + '\n```');
      remaining = '```\n' + remaining.slice(splitAt).trimStart();
    } else {
      chunks.push(chunk);
      remaining = remaining.slice(splitAt).trimStart();
    }
  }

  return chunks;
}
