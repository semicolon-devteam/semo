/**
 * Output Matcher
 * 테스트 출력과 기대값 매칭
 */

import { ExpectedResult, VerificationResult, GhCommandExpectation } from '../schema';

/**
 * 라우팅 검증
 */
export function verifyRouting(
  actual: { layer: string; package: string; mode?: string },
  expected: ExpectedResult['routing']
): VerificationResult {
  const layerMatch = actual.layer === expected.layer;
  const packageMatch = actual.package === expected.package;
  const modeMatch = !expected.mode || actual.mode === expected.mode;

  const passed = layerMatch && packageMatch && modeMatch;

  return {
    passed,
    expected: `${expected.layer}/${expected.package}${expected.mode ? ` (${expected.mode})` : ''}`,
    actual: `${actual.layer}/${actual.package}${actual.mode ? ` (${actual.mode})` : ''}`,
    message: passed ? 'Routing matched' : 'Routing mismatch',
  };
}

/**
 * 스킬 호출 검증
 */
export function verifySkill(actualSkill: string, expectedSkill: string): VerificationResult {
  const passed = actualSkill === expectedSkill;

  return {
    passed,
    expected: expectedSkill,
    actual: actualSkill,
    message: passed ? 'Skill matched' : 'Skill mismatch',
  };
}

/**
 * 출력 검증
 */
export function verifyOutput(output: string, expected: ExpectedResult['output']): VerificationResult {
  const errors: string[] = [];

  // contains 검증
  if (expected.contains) {
    for (const str of expected.contains) {
      if (!output.includes(str)) {
        errors.push(`Missing: "${str}"`);
      }
    }
  }

  // notContains 검증
  if (expected.notContains) {
    for (const str of expected.notContains) {
      if (output.includes(str)) {
        errors.push(`Should not contain: "${str}"`);
      }
    }
  }

  // pattern 검증
  if (expected.pattern) {
    const regex = new RegExp(expected.pattern);
    if (!regex.test(output)) {
      errors.push(`Pattern not matched: ${expected.pattern}`);
    }
  }

  // startsWith 검증
  if (expected.startsWith) {
    if (!output.trim().startsWith(expected.startsWith)) {
      errors.push(`Should start with: "${expected.startsWith}"`);
    }
  }

  // endsWith 검증
  if (expected.endsWith) {
    if (!output.trim().endsWith(expected.endsWith)) {
      errors.push(`Should end with: "${expected.endsWith}"`);
    }
  }

  const passed = errors.length === 0;

  return {
    passed,
    expected: JSON.stringify(expected),
    actual: output.substring(0, 200) + (output.length > 200 ? '...' : ''),
    message: passed ? 'Output matched' : errors.join('; '),
  };
}

/**
 * gh 명령 호출 검증
 */
export function verifyGhCommands(
  executedCommands: string[],
  expected: GhCommandExpectation[]
): VerificationResult {
  const errors: string[] = [];

  for (const exp of expected) {
    const regex = new RegExp(exp.pattern);
    const matched = executedCommands.some((cmd) => {
      if (!regex.test(cmd)) return false;
      if (exp.contains && !cmd.includes(exp.contains)) return false;
      return true;
    });

    if (!matched) {
      errors.push(`Command not found: ${exp.pattern}${exp.contains ? ` (contains: ${exp.contains})` : ''}`);
    }
  }

  const passed = errors.length === 0;

  return {
    passed,
    expected: expected.map((e) => e.pattern).join(', '),
    actual: executedCommands.join('\n'),
    message: passed ? 'gh commands matched' : errors.join('; '),
  };
}

/**
 * 파일 존재 검증
 */
export function verifyFiles(
  files: { path: string; exists: boolean; content?: string }[],
  expected: ExpectedResult['sideEffects']
): VerificationResult {
  if (!expected?.files) {
    return { passed: true, expected: 'none', actual: 'none', message: 'No file checks' };
  }

  const errors: string[] = [];

  for (const exp of expected.files) {
    const file = files.find((f) => f.path.includes(exp.path));

    if (exp.exists) {
      if (!file || !file.exists) {
        errors.push(`File should exist: ${exp.path}`);
      } else if (exp.contains) {
        for (const str of exp.contains) {
          if (!file.content?.includes(str)) {
            errors.push(`File ${exp.path} should contain: "${str}"`);
          }
        }
      }
    } else {
      if (file?.exists) {
        errors.push(`File should not exist: ${exp.path}`);
      }
    }
  }

  const passed = errors.length === 0;

  return {
    passed,
    expected: JSON.stringify(expected.files),
    actual: JSON.stringify(files),
    message: passed ? 'File checks passed' : errors.join('; '),
  };
}

/**
 * SEMO 메시지에서 라우팅 정보 추출
 */
export function extractRouting(output: string): { layer: string; package: string; mode?: string } | null {
  // [SEMO] Orchestrator: 의도 분석 완료 → biz/management
  // [SEMO] Skill 위임: biz/management
  const routingMatch = output.match(/\[SEMO\].*(?:→|:)\s*(\w+)\/(\w+)(?:\s*\((\w+)\))?/);

  if (routingMatch) {
    return {
      layer: routingMatch[1],
      package: routingMatch[2],
      mode: routingMatch[3],
    };
  }

  return null;
}

/**
 * SEMO 메시지에서 스킬 이름 추출
 */
export function extractSkill(output: string): string | null {
  // [SEMO] Skill: list-my-tasks 호출
  const skillMatch = output.match(/\[SEMO\] Skill:\s*([\w-]+)/);
  return skillMatch ? skillMatch[1] : null;
}
