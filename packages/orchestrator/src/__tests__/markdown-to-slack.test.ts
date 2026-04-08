import { describe, it, expect } from 'vitest';
import { convertMarkdownToMrkdwn, convertMarkdownToBlocks } from '../markdown-to-slack.js';

// ── convertMarkdownToMrkdwn ────────────────────────────

describe('convertMarkdownToMrkdwn', () => {
  it('converts **bold** to *bold*', () => {
    expect(convertMarkdownToMrkdwn('hello **world**')).toBe('hello *world*');
  });

  it('converts __bold__ to *bold*', () => {
    expect(convertMarkdownToMrkdwn('hello __world__')).toBe('hello *world*');
  });

  it('converts ~~strike~~ to ~strike~', () => {
    expect(convertMarkdownToMrkdwn('~~deleted~~')).toBe('~deleted~');
  });

  it('converts [text](url) to <url|text>', () => {
    expect(convertMarkdownToMrkdwn('[click](https://ex.com)')).toBe('<https://ex.com|click>');
  });

  it('converts ![alt](url) to <url|alt>', () => {
    expect(convertMarkdownToMrkdwn('![img](https://ex.com/a.png)')).toBe(
      '<https://ex.com/a.png|img>',
    );
  });

  it('preserves inline code', () => {
    expect(convertMarkdownToMrkdwn('run `**not bold**` here')).toBe('run `**not bold**` here');
  });

  it('converts list bullets * to •', () => {
    expect(convertMarkdownToMrkdwn('* item one\n* item two')).toBe('• item one\n• item two');
  });

  it('passes through Slack mentions <@U123> unchanged', () => {
    expect(convertMarkdownToMrkdwn('hi <@U123ABC>')).toBe('hi <@U123ABC>');
  });

  it('passes through bare URLs', () => {
    expect(convertMarkdownToMrkdwn('see https://example.com')).toBe('see https://example.com');
  });

  it('handles combined formatting', () => {
    expect(convertMarkdownToMrkdwn('**bold** and ~~strike~~')).toBe('*bold* and ~strike~');
  });

  it('handles blockquotes (already compatible)', () => {
    expect(convertMarkdownToMrkdwn('> quoted text')).toBe('> quoted text');
  });
});

// ── convertMarkdownToBlocks ────────────────────────────

describe('convertMarkdownToBlocks', () => {
  it('returns empty blocks for empty input', () => {
    const payloads = convertMarkdownToBlocks('');
    expect(payloads).toHaveLength(1);
    expect(payloads[0].blocks).toHaveLength(0);
  });

  it('converts heading to header block', () => {
    const [payload] = convertMarkdownToBlocks('# Hello World');
    expect(payload.blocks).toHaveLength(1);
    expect(payload.blocks[0]).toEqual({
      type: 'header',
      text: { type: 'plain_text', text: 'Hello World', emoji: true },
    });
  });

  it('converts ## and ### headings to header blocks', () => {
    const [payload] = convertMarkdownToBlocks('## Sub\n### Deep');
    expect(payload.blocks).toHaveLength(2);
    expect(payload.blocks[0].type).toBe('header');
    expect(payload.blocks[1].type).toBe('header');
  });

  it('converts --- to divider block', () => {
    const [payload] = convertMarkdownToBlocks('text\n---\nmore');
    const types = payload.blocks.map((b) => b.type);
    expect(types).toEqual(['section', 'divider', 'section']);
  });

  it('converts fenced code block to section with triple backticks', () => {
    const md = '```js\nconst x = 1;\n```';
    const [payload] = convertMarkdownToBlocks(md);
    expect(payload.blocks).toHaveLength(1);
    expect(payload.blocks[0].type).toBe('section');
    expect(payload.blocks[0].text?.text).toContain('```');
    expect(payload.blocks[0].text?.text).toContain('const x = 1;');
  });

  it('converts paragraph with inline markdown', () => {
    const [payload] = convertMarkdownToBlocks('This is **bold** text');
    expect(payload.blocks[0].text?.text).toBe('This is *bold* text');
  });

  it('converts 2-column table to fields layout', () => {
    const md = '| Key | Value |\n|---|---|\n| a | 1 |\n| b | 2 |';
    const [payload] = convertMarkdownToBlocks(md);
    // header fields + data fields
    expect(payload.blocks.length).toBeGreaterThanOrEqual(2);
    expect(payload.blocks[0].fields).toBeDefined();
    expect(payload.blocks[0].fields).toHaveLength(2);
    expect(payload.blocks[0].fields![0].text).toBe('*Key*');
  });

  it('converts 3+ column table to monospace text', () => {
    const md = '| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |';
    const [payload] = convertMarkdownToBlocks(md);
    expect(payload.blocks[0].text?.text).toContain('```');
  });

  it('generates fallback text with mrkdwn conversion', () => {
    const [payload] = convertMarkdownToBlocks('**bold** text');
    expect(payload.text).toContain('*bold* text');
  });

  it('handles mixed content correctly', () => {
    const md = [
      '# Title',
      '',
      'Some **bold** paragraph.',
      '',
      '---',
      '',
      '```',
      'code here',
      '```',
      '',
      '| Col1 | Col2 |',
      '|---|---|',
      '| a | b |',
    ].join('\n');

    const [payload] = convertMarkdownToBlocks(md);
    const types = payload.blocks.map((b) => b.type);

    expect(types[0]).toBe('header'); // # Title
    expect(types).toContain('divider'); // ---
    expect(types).toContain('section'); // paragraph, code, table
  });

  it('preserves [Route:] tags unchanged', () => {
    const [payload] = convertMarkdownToBlocks('[Route: workclaw] hello');
    expect(payload.blocks[0].text?.text).toContain('[Route: workclaw]');
  });

  it('splits very long text into multiple section blocks', () => {
    const longText = 'x'.repeat(4000);
    const [payload] = convertMarkdownToBlocks(longText);
    expect(payload.blocks.length).toBeGreaterThan(1);
    for (const block of payload.blocks) {
      if (block.text) {
        expect(block.text.text.length).toBeLessThanOrEqual(3000);
      }
    }
  });

  it('splits 50+ blocks into multiple payloads', () => {
    // 60 headings → 60 blocks → 2 payloads
    const md = Array.from({ length: 60 }, (_, i) => `# Heading ${i}`).join('\n');
    const payloads = convertMarkdownToBlocks(md);
    expect(payloads.length).toBe(2);
    expect(payloads[0].blocks.length).toBe(50);
    expect(payloads[1].blocks.length).toBe(10);
  });

  it('truncates header text exceeding 150 chars', () => {
    const longHeading = '# ' + 'A'.repeat(200);
    const [payload] = convertMarkdownToBlocks(longHeading);
    expect(payload.blocks[0].text?.text.length).toBeLessThanOrEqual(150);
  });
});
