/**
 * 환경변수 유틸리티
 */

/**
 * 디버그 모드 확인
 */
export function isDebugMode(): boolean {
  return process.env.SEMO_HOOKS_DEBUG === 'true' || process.env.SEMO_HOOKS_DEBUG === '1';
}

/**
 * 디버그 로그 출력 (stderr)
 */
export function debugLog(...args: unknown[]): void {
  if (isDebugMode()) {
    console.error('[semo-hooks]', ...args);
  }
}

/**
 * stdin에서 JSON 읽기
 */
export async function readStdinJson<T>(): Promise<T> {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      try {
        const parsed = JSON.parse(data) as T;
        resolve(parsed);
      } catch (error) {
        reject(new Error(`Failed to parse stdin JSON: ${(error as Error).message}`));
      }
    });

    process.stdin.on('error', reject);
  });
}

/**
 * stdout으로 JSON 출력
 */
export function writeStdoutJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}
