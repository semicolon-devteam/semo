/**
 * Prompt Detector
 *
 * Detects Claude Code permission and selection prompts from terminal output.
 * Used by LocalSessionExecutor to auto-respond to prompts.
 */

export type PromptType = 'permission' | 'selection' | 'confirmation' | 'input';

export interface DetectedPrompt {
  type: PromptType;
  toolName?: string;           // Permission target tool (Write, Bash, etc.)
  options?: PromptOption[];    // Selection options list
  question?: string;           // Question content
  originalText: string;        // Original text that matched
  selectedIndex?: number;      // Currently highlighted option (1-based)
}

export interface PromptOption {
  index: number;               // 1-based index
  label: string;               // Option text
  isSelected?: boolean;        // Whether this option is currently selected
}

export class PromptDetector {
  // Permission prompt patterns
  private static PERMISSION_PATTERNS = [
    /Do you want to proceed\?/i,
    /Allow .+ to execute\?/i,
    /Permission required/i,
    /\[y\/n\]/i,
    /\[Y\/n\]/i,
  ];

  // Selection prompt pattern (Claude Code uses > 1. Option format)
  // Matches lines like:
  // > 1. Yes
  // > 2. Yes, allow reading from office/ during this session
  // > 3. Type here to tell Claude what to do differently
  private static SELECTION_LINE_PATTERN = /^[❯>]\s*(\d+)\.\s+(.+)$/gm;

  // "Esc to cancel" indicates interactive prompt
  private static ESC_CANCEL_PATTERN = /Esc to cancel/i;

  // Tool name extraction patterns
  private static TOOL_PATTERNS = [
    /tool:\s*(\w+)/i,
    /execute\s+(\w+)/i,
    /allow\s+(\w+)/i,
    /running\s+(\w+)/i,
  ];

  /**
   * Detect if the screen content contains a prompt that needs auto-response
   */
  detect(screenContent: string): DetectedPrompt | null {
    // Check for selection prompt first (more specific)
    const selectionPrompt = this.detectSelectionPrompt(screenContent);
    if (selectionPrompt) {
      return selectionPrompt;
    }

    // Check for simple y/n permission prompt
    const permissionPrompt = this.detectPermissionPrompt(screenContent);
    if (permissionPrompt) {
      return permissionPrompt;
    }

    return null;
  }

  /**
   * Detect Claude Code selection prompt (1. Yes / 2. Option / 3. Type here)
   */
  private detectSelectionPrompt(screenContent: string): DetectedPrompt | null {
    // Look for "Esc to cancel" which indicates interactive prompt
    if (!PromptDetector.ESC_CANCEL_PATTERN.test(screenContent)) {
      return null;
    }

    // Extract options from screen content
    const options: PromptOption[] = [];
    const lines = screenContent.split('\n');

    for (const line of lines) {
      // Reset regex lastIndex
      PromptDetector.SELECTION_LINE_PATTERN.lastIndex = 0;
      const match = PromptDetector.SELECTION_LINE_PATTERN.exec(line);
      if (match) {
        const index = parseInt(match[1], 10);
        const label = match[2].trim();
        const isSelected = line.startsWith('❯') || line.includes('❯');

        options.push({ index, label, isSelected });
      }
    }

    if (options.length >= 2) {
      // Find the question/context (usually above the options)
      const question = this.extractQuestion(screenContent, options);
      const selectedIndex = options.find(o => o.isSelected)?.index || 1;

      return {
        type: 'selection',
        options,
        question,
        selectedIndex,
        originalText: screenContent,
      };
    }

    return null;
  }

  /**
   * Detect simple y/n permission prompt
   */
  private detectPermissionPrompt(screenContent: string): DetectedPrompt | null {
    for (const pattern of PromptDetector.PERMISSION_PATTERNS) {
      if (pattern.test(screenContent)) {
        const toolName = this.extractToolName(screenContent);

        return {
          type: 'permission',
          toolName,
          originalText: screenContent,
        };
      }
    }

    return null;
  }

  /**
   * Extract tool name from prompt content
   */
  private extractToolName(content: string): string | undefined {
    for (const pattern of PromptDetector.TOOL_PATTERNS) {
      const match = pattern.exec(content);
      if (match) {
        return match[1];
      }
    }
    return undefined;
  }

  /**
   * Extract question text from content (text before options)
   */
  private extractQuestion(content: string, options: PromptOption[]): string | undefined {
    const lines = content.split('\n');
    const firstOptionIndex = options[0]?.index;

    // Find where options start and get text before
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(`${firstOptionIndex}.`) && (line.startsWith('>') || line.startsWith('❯'))) {
        // Get previous non-empty lines as question
        const questionLines: string[] = [];
        for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
          const prevLine = lines[j].trim();
          if (prevLine && !prevLine.startsWith('>') && !prevLine.startsWith('❯')) {
            questionLines.unshift(prevLine);
          }
        }
        if (questionLines.length > 0) {
          return questionLines.join(' ').trim();
        }
        break;
      }
    }

    return undefined;
  }

  /**
   * Check if content likely contains a prompt waiting for input
   * This is a quick check before doing full detection
   */
  static mightContainPrompt(content: string): boolean {
    // Quick checks for common prompt indicators
    return (
      content.includes('Esc to cancel') ||
      content.includes('[y/n]') ||
      content.includes('[Y/n]') ||
      content.includes('Do you want to proceed') ||
      content.includes('> 1.') ||
      content.includes('❯ 1.')
    );
  }
}
