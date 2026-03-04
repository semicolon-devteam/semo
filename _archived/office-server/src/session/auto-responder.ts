/**
 * Auto Responder
 *
 * Determines automatic responses to Claude Code permission and selection prompts.
 * Configurable per-session to allow different behaviors for different agents.
 */

import type { DetectedPrompt, PromptOption } from './prompt-detector.js';

export interface AutoResponseConfig {
  /** Enable auto-response (default: true) */
  enabled: boolean;

  /** Tools to always allow (whitelist) */
  allowedTools: string[];

  /** Tools to always deny (blacklist) - takes precedence over allowedTools */
  deniedTools: string[];

  /** Default behavior when tool not in either list: 'allow' | 'deny' | 'prompt' */
  defaultBehavior: 'allow' | 'deny' | 'prompt';

  /** Default selection for selection prompts (1-based index, default: 1 = "Yes") */
  defaultSelection: number;

  /** Prefer "allow for session" options (index 2 typically) */
  preferSessionAllow: boolean;

  /** Dangerous patterns that should never be auto-approved */
  dangerousPatterns: RegExp[];

  /** Response delay in ms (to ensure screen is fully rendered) */
  responseDelayMs: number;
}

export interface AutoResponseResult {
  shouldRespond: boolean;
  response?: string;
  reason: string;
}

export const DEFAULT_AUTO_RESPONSE_CONFIG: AutoResponseConfig = {
  enabled: true,
  allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'Task'],
  deniedTools: [],
  defaultBehavior: 'allow',
  defaultSelection: 1,
  preferSessionAllow: true,  // Prefer "Yes, allow for session" to reduce prompts
  dangerousPatterns: [
    /rm\s+-rf\s+[\/~]/i,      // rm -rf with absolute or home path
    /rm\s+--no-preserve-root/i,
    /mkfs/i,
    /dd\s+if=.*of=\/dev/i,    // dd to device
    />\s*\/dev\//i,           // redirect to device
    /chmod\s+777\s+\//i,      // chmod 777 on root
    /curl.*\|\s*bash/i,       // curl | bash
    /wget.*\|\s*bash/i,       // wget | bash
  ],
  responseDelayMs: 100,
};

export class AutoResponder {
  private config: AutoResponseConfig;

  constructor(config: Partial<AutoResponseConfig> = {}) {
    this.config = { ...DEFAULT_AUTO_RESPONSE_CONFIG, ...config };
  }

  /**
   * Determine if and how to respond to a detected prompt
   */
  resolve(prompt: DetectedPrompt): AutoResponseResult {
    if (!this.config.enabled) {
      return { shouldRespond: false, reason: 'Auto-response disabled' };
    }

    // Check for dangerous patterns
    if (this.containsDangerousPattern(prompt.originalText)) {
      return { shouldRespond: false, reason: 'Dangerous pattern detected' };
    }

    switch (prompt.type) {
      case 'permission':
        return this.resolvePermission(prompt);
      case 'selection':
        return this.resolveSelection(prompt);
      case 'confirmation':
        return this.resolveConfirmation(prompt);
      default:
        return { shouldRespond: false, reason: `Unknown prompt type: ${prompt.type}` };
    }
  }

  /**
   * Resolve permission prompt (y/n)
   */
  private resolvePermission(prompt: DetectedPrompt): AutoResponseResult {
    const toolName = prompt.toolName;

    // Check if tool is in denied list
    if (toolName && this.config.deniedTools.includes(toolName)) {
      return {
        shouldRespond: true,
        response: 'n',
        reason: `Tool ${toolName} is in denied list`,
      };
    }

    // Check if tool is in allowed list
    if (toolName && this.config.allowedTools.includes(toolName)) {
      return {
        shouldRespond: true,
        response: 'y',
        reason: `Tool ${toolName} is in allowed list`,
      };
    }

    // Use default behavior
    switch (this.config.defaultBehavior) {
      case 'allow':
        return {
          shouldRespond: true,
          response: 'y',
          reason: 'Default behavior is allow',
        };
      case 'deny':
        return {
          shouldRespond: true,
          response: 'n',
          reason: 'Default behavior is deny',
        };
      default:
        return { shouldRespond: false, reason: 'Default behavior is prompt (manual)' };
    }
  }

  /**
   * Resolve selection prompt (1/2/3...)
   */
  private resolveSelection(prompt: DetectedPrompt): AutoResponseResult {
    const options = prompt.options || [];

    if (options.length === 0) {
      return { shouldRespond: false, reason: 'No options detected' };
    }

    // If preferSessionAllow is true and there's an option with "session" or "allow", prefer it
    if (this.config.preferSessionAllow) {
      const sessionOption = options.find(
        (opt) =>
          opt.label.toLowerCase().includes('session') ||
          (opt.label.toLowerCase().includes('yes') && opt.label.toLowerCase().includes('allow'))
      );

      if (sessionOption) {
        return {
          shouldRespond: true,
          response: String(sessionOption.index),
          reason: `Selected session-allow option: ${sessionOption.label}`,
        };
      }
    }

    // Check if any option looks like "Yes" or affirmative
    const yesOption = options.find(
      (opt) =>
        opt.label.toLowerCase() === 'yes' ||
        opt.label.toLowerCase().startsWith('yes,') ||
        opt.label.toLowerCase().startsWith('yes ')
    );

    if (yesOption && this.config.defaultBehavior === 'allow') {
      return {
        shouldRespond: true,
        response: String(yesOption.index),
        reason: `Selected yes option: ${yesOption.label}`,
      };
    }

    // Check if any option looks like "No" or negative
    const noOption = options.find(
      (opt) =>
        opt.label.toLowerCase() === 'no' ||
        opt.label.toLowerCase().startsWith('no,') ||
        opt.label.toLowerCase().startsWith('no ')
    );

    if (noOption && this.config.defaultBehavior === 'deny') {
      return {
        shouldRespond: true,
        response: String(noOption.index),
        reason: `Selected no option: ${noOption.label}`,
      };
    }

    // Use default selection index
    const defaultIndex = this.config.defaultSelection;
    if (defaultIndex >= 1 && defaultIndex <= options.length) {
      return {
        shouldRespond: true,
        response: String(defaultIndex),
        reason: `Using default selection index: ${defaultIndex}`,
      };
    }

    return { shouldRespond: false, reason: 'No suitable option found' };
  }

  /**
   * Resolve confirmation prompt
   */
  private resolveConfirmation(prompt: DetectedPrompt): AutoResponseResult {
    // Treat confirmation like permission
    return this.resolvePermission(prompt);
  }

  /**
   * Check if content contains dangerous patterns
   */
  private containsDangerousPattern(content: string): boolean {
    return this.config.dangerousPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Get response delay
   */
  getResponseDelay(): number {
    return this.config.responseDelayMs;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutoResponseConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): AutoResponseConfig {
    return { ...this.config };
  }
}
