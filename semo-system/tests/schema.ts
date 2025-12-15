/**
 * SEMO Test Case Schema
 * 테스트 케이스 YAML 파일의 타입 정의
 */

export interface TestCase {
  /** 테스트 케이스 이름 */
  name: string;

  /** 테스트 설명 */
  description: string;

  /** 카테고리 (예: biz/management, eng/nextjs) */
  category: string;

  /** 사용자 입력 */
  input: string;

  /** 기대 결과 */
  expected: ExpectedResult;

  /** Mock 데이터 (선택) */
  mock?: MockData;

  /** 태그 (필터링용) */
  tags?: string[];

  /** 스킵 여부 */
  skip?: boolean;

  /** 타임아웃 (ms) */
  timeout?: number;
}

export interface ExpectedResult {
  /** 라우팅 검증 */
  routing: {
    /** 레이어 (biz, eng, ops) */
    layer: 'biz' | 'eng' | 'ops';
    /** 패키지 (management, nextjs 등) */
    package: string;
    /** 모드 (mvp, prod) - 선택 */
    mode?: 'mvp' | 'prod';
  };

  /** 호출되어야 할 스킬 */
  skill: string;

  /** 출력 검증 */
  output: {
    /** 포함해야 할 문자열 목록 */
    contains?: string[];
    /** 포함하지 않아야 할 문자열 목록 */
    notContains?: string[];
    /** 정규식 패턴 */
    pattern?: string;
    /** 시작 문자열 */
    startsWith?: string;
    /** 종료 문자열 */
    endsWith?: string;
  };

  /** 부수 효과 검증 */
  sideEffects?: {
    /** gh 명령 호출 검증 */
    ghCommands?: GhCommandExpectation[];
    /** 파일 생성/수정 검증 */
    files?: FileExpectation[];
  };
}

export interface GhCommandExpectation {
  /** 명령 패턴 (정규식) */
  pattern: string;
  /** 포함해야 할 문자열 */
  contains?: string;
  /** 기대 응답 (Mock 모드) */
  mockResponse?: string;
}

export interface FileExpectation {
  /** 파일 경로 패턴 */
  path: string;
  /** 파일 존재 여부 */
  exists: boolean;
  /** 파일 내용 포함 문자열 */
  contains?: string[];
}

export interface MockData {
  /** gh api 응답 */
  ghApiResponse?: string;
  /** 환경 변수 */
  env?: Record<string, string>;
  /** 현재 브랜치 */
  currentBranch?: string;
  /** 현재 사용자 */
  currentUser?: string;
}

/**
 * 테스트 결과
 */
export interface TestResult {
  /** 테스트 케이스 이름 */
  name: string;
  /** 통과 여부 */
  passed: boolean;
  /** 소요 시간 (ms) */
  duration: number;
  /** 검증 결과 상세 */
  details: {
    routing: VerificationResult;
    skill: VerificationResult;
    output: VerificationResult;
    sideEffects?: VerificationResult;
  };
  /** 에러 메시지 (실패 시) */
  error?: string;
}

export interface VerificationResult {
  passed: boolean;
  expected: string;
  actual: string;
  message?: string;
}

/**
 * 테스트 실행 옵션
 */
export interface RunnerOptions {
  /** 특정 케이스만 실행 */
  case?: string;
  /** 특정 레이어만 실행 */
  layer?: 'biz' | 'eng' | 'ops';
  /** E2E 모드 (실제 API 호출) */
  e2e?: boolean;
  /** Mock 모드 (기본값) */
  mock?: boolean;
  /** 상세 출력 */
  verbose?: boolean;
  /** 병렬 실행 수 */
  parallel?: number;
  /** 태그 필터 */
  tags?: string[];
}

/**
 * 테스트 리포트
 */
export interface TestReport {
  /** 실행 시간 */
  timestamp: string;
  /** 실행 모드 */
  mode: 'e2e' | 'mock';
  /** 총 테스트 수 */
  total: number;
  /** 통과 */
  passed: number;
  /** 실패 */
  failed: number;
  /** 스킵 */
  skipped: number;
  /** 총 소요 시간 (ms) */
  duration: number;
  /** 개별 결과 */
  results: TestResult[];
}
