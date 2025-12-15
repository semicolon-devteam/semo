/**
 * YAML Test Case Parser
 * 테스트 케이스 YAML 파일을 파싱
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { TestCase } from '../schema';

/**
 * 단일 테스트 케이스 파일 파싱 (여러 문서 지원)
 */
export function parseTestCase(filePath: string): TestCase {
  const content = fs.readFileSync(filePath, 'utf-8');
  const documents: TestCase[] = [];

  yaml.loadAll(content, (doc) => {
    if (doc) documents.push(doc as TestCase);
  });

  if (documents.length === 0) {
    throw new Error(`No valid YAML documents found in ${filePath}`);
  }

  // 첫 번째 문서만 반환 (메인 테스트 케이스)
  const parsed = documents[0];

  // 필수 필드 검증
  validateTestCase(parsed, filePath);

  return parsed;
}

/**
 * 단일 테스트 케이스 파일에서 모든 문서 파싱
 */
export function parseTestCaseAll(filePath: string): TestCase[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const documents: TestCase[] = [];

  yaml.loadAll(content, (doc) => {
    if (doc) documents.push(doc as TestCase);
  });

  // 모든 문서 검증
  documents.forEach((doc) => validateTestCase(doc, filePath));

  return documents;
}

/**
 * 디렉토리 내 모든 테스트 케이스 파싱
 */
export function parseAllTestCases(casesDir: string): TestCase[] {
  const cases: TestCase[] = [];
  const layers = ['biz', 'eng', 'ops'];

  for (const layer of layers) {
    const layerDir = path.join(casesDir, layer);
    if (!fs.existsSync(layerDir)) continue;

    const files = fs.readdirSync(layerDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

    for (const file of files) {
      const filePath = path.join(layerDir, file);
      try {
        const testCase = parseTestCase(filePath);
        cases.push(testCase);
      } catch (error) {
        console.error(`Failed to parse ${filePath}:`, error);
      }
    }
  }

  return cases;
}

/**
 * 특정 레이어의 테스트 케이스만 파싱
 */
export function parseLayerTestCases(casesDir: string, layer: 'biz' | 'eng' | 'ops'): TestCase[] {
  const layerDir = path.join(casesDir, layer);
  if (!fs.existsSync(layerDir)) return [];

  const files = fs.readdirSync(layerDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

  return files
    .map((file) => {
      try {
        return parseTestCase(path.join(layerDir, file));
      } catch {
        return null;
      }
    })
    .filter((c): c is TestCase => c !== null);
}

/**
 * 특정 이름의 테스트 케이스 찾기
 */
export function findTestCase(casesDir: string, name: string): TestCase | null {
  const allCases = parseAllTestCases(casesDir);
  return allCases.find((c) => c.name === name) || null;
}

/**
 * 테스트 케이스 유효성 검증
 */
function validateTestCase(testCase: TestCase, filePath: string): void {
  const errors: string[] = [];

  if (!testCase.name) {
    errors.push('name is required');
  }

  if (!testCase.input) {
    errors.push('input is required');
  }

  if (!testCase.expected) {
    errors.push('expected is required');
  } else {
    if (!testCase.expected.routing) {
      errors.push('expected.routing is required');
    } else {
      if (!testCase.expected.routing.layer) {
        errors.push('expected.routing.layer is required');
      }
      if (!testCase.expected.routing.package) {
        errors.push('expected.routing.package is required');
      }
    }

    if (!testCase.expected.skill) {
      errors.push('expected.skill is required');
    }

    if (!testCase.expected.output) {
      errors.push('expected.output is required');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid test case ${filePath}:\n  - ${errors.join('\n  - ')}`);
  }
}

/**
 * 테스트 케이스 태그로 필터링
 */
export function filterByTags(cases: TestCase[], tags: string[]): TestCase[] {
  if (tags.length === 0) return cases;
  return cases.filter((c) => c.tags?.some((t) => tags.includes(t)));
}

/**
 * skip 플래그 없는 케이스만 필터링
 */
export function filterActive(cases: TestCase[]): TestCase[] {
  return cases.filter((c) => !c.skip);
}
