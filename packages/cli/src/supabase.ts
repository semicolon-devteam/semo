/**
 * SEMO CLI - Supabase 클라이언트
 *
 * package_definitions 테이블에서 패키지 정보를 조회합니다.
 * DB 연결 실패 시 하드코딩된 폴백 데이터를 사용합니다.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase 연결 정보 (공개 프로젝트용)
const SUPABASE_URL =
  process.env.SEMO_SUPABASE_URL || "https://qjmvmxpmwtdpjorvxynt.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SEMO_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqbXZteHBtd3RkcGpvcnZ4eW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY2MTUzMjMsImV4cCI6MjA1MjE5MTMyM30.WMT-rOlXbcN2gT8V58hN9P1SsH0sIvR4s2j5GjIrT_Q";

// 패키지 정의 타입
export interface PackageDefinition {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  layer: "standard" | "biz" | "eng" | "ops" | "system" | "meta";
  package_type: "standard" | "extension";
  version: string;
  repo_url: string;
  source_path: string;
  detect_files: string[];
  depends_on: string[];
  aliases: string[];
  is_active: boolean;
  is_required: boolean;
  install_order: number;
}

// Supabase 클라이언트 (싱글톤)
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

// DB 연결 가능 여부 확인
let dbAvailable: boolean | null = null;

async function checkDbConnection(): Promise<boolean> {
  if (dbAvailable !== null) return dbAvailable;

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("package_definitions")
      .select("id")
      .limit(1);
    dbAvailable = !error;
  } catch {
    dbAvailable = false;
  }

  return dbAvailable;
}

/**
 * 모든 패키지 목록 조회
 */
export async function getPackages(
  layer?: string
): Promise<PackageDefinition[]> {
  const isConnected = await checkDbConnection();

  if (!isConnected) {
    console.warn("⚠️ DB 연결 실패, 폴백 데이터 사용");
    return getFallbackPackages(layer);
  }

  const supabase = getSupabaseClient();
  let query = supabase
    .from("package_definitions")
    .select("*")
    .eq("is_active", true);

  if (layer) {
    query = query.eq("layer", layer);
  }

  const { data, error } = await query.order("install_order");

  if (error) {
    console.warn("⚠️ 패키지 조회 실패, 폴백 데이터 사용");
    return getFallbackPackages(layer);
  }

  return data || [];
}

/**
 * Standard 패키지 목록 조회
 */
export async function getStandardPackages(): Promise<PackageDefinition[]> {
  const isConnected = await checkDbConnection();

  if (!isConnected) {
    return getFallbackPackages().filter((p) => p.package_type === "standard");
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("package_definitions")
    .select("*")
    .eq("package_type", "standard")
    .eq("is_active", true)
    .order("install_order");

  if (error) {
    return getFallbackPackages().filter((p) => p.package_type === "standard");
  }

  return data || [];
}

/**
 * Extension 패키지 목록 조회
 */
export async function getExtensionPackages(
  layer?: string
): Promise<PackageDefinition[]> {
  const isConnected = await checkDbConnection();

  if (!isConnected) {
    const fallback = getFallbackPackages(layer);
    return fallback.filter((p) => p.package_type === "extension");
  }

  const supabase = getSupabaseClient();
  let query = supabase
    .from("package_definitions")
    .select("*")
    .eq("package_type", "extension")
    .eq("is_active", true);

  if (layer) {
    query = query.eq("layer", layer);
  }

  const { data, error } = await query.order("install_order");

  if (error) {
    const fallback = getFallbackPackages(layer);
    return fallback.filter((p) => p.package_type === "extension");
  }

  return data || [];
}

/**
 * 패키지명 또는 별칭으로 패키지 찾기
 */
export async function resolvePackageName(
  input: string
): Promise<string | null> {
  const isConnected = await checkDbConnection();

  if (!isConnected) {
    return resolveFallbackPackageName(input);
  }

  const supabase = getSupabaseClient();

  // 1. 정확한 이름 매칭
  const { data: exactMatch } = await supabase
    .from("package_definitions")
    .select("name")
    .eq("name", input)
    .eq("is_active", true)
    .single();

  if (exactMatch) return exactMatch.name;

  // 2. 별칭 매칭 (aliases 배열에 포함)
  const { data: aliasMatch } = await supabase
    .from("package_definitions")
    .select("name")
    .contains("aliases", [input])
    .eq("is_active", true)
    .single();

  if (aliasMatch) return aliasMatch.name;

  return null;
}

/**
 * 패키지 버전 조회
 */
export async function getPackageVersion(name: string): Promise<string | null> {
  const isConnected = await checkDbConnection();

  if (!isConnected) {
    const pkg = getFallbackPackages().find((p) => p.name === name);
    return pkg?.version || null;
  }

  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("package_definitions")
    .select("version")
    .eq("name", name)
    .single();

  return data?.version || null;
}

/**
 * 그룹별 패키지 목록 조회
 */
export async function getPackagesByGroup(
  group: string
): Promise<PackageDefinition[]> {
  return getExtensionPackages(group);
}

/**
 * 프로젝트 타입 감지용 패키지 조회
 */
export async function getDetectablePackages(): Promise<PackageDefinition[]> {
  const packages = await getExtensionPackages();
  return packages.filter((p) => p.detect_files && p.detect_files.length > 0);
}

// ============================================================
// 폴백 데이터 (DB 연결 실패 시 사용)
// ============================================================

const FALLBACK_PACKAGES: PackageDefinition[] = [
  // Standard
  {
    id: "std-core",
    name: "semo-core",
    display_name: "SEMO Core",
    description: "원칙, 오케스트레이터, 공통 커맨드",
    layer: "standard",
    package_type: "standard",
    version: "3.8.0",
    repo_url: "https://github.com/semicolon-devteam/semo.git",
    source_path: "semo-system/semo-core",
    detect_files: [],
    depends_on: [],
    aliases: [],
    is_active: true,
    is_required: true,
    install_order: 10,
  },
  {
    id: "std-skills",
    name: "semo-skills",
    display_name: "SEMO Skills",
    description: "13개 통합 스킬",
    layer: "standard",
    package_type: "standard",
    version: "3.8.0",
    repo_url: "https://github.com/semicolon-devteam/semo.git",
    source_path: "semo-system/semo-skills",
    detect_files: [],
    depends_on: [],
    aliases: [],
    is_active: true,
    is_required: true,
    install_order: 20,
  },
  {
    id: "std-scripts",
    name: "semo-scripts",
    display_name: "SEMO Scripts",
    description: "자동화 스크립트",
    layer: "standard",
    package_type: "standard",
    version: "3.8.0",
    repo_url: "https://github.com/semicolon-devteam/semo.git",
    source_path: "semo-system/semo-scripts",
    detect_files: [],
    depends_on: [],
    aliases: [],
    is_active: true,
    is_required: true,
    install_order: 30,
  },

  // Business Layer
  {
    id: "biz-discovery",
    name: "biz/discovery",
    display_name: "Discovery",
    description: "아이템 발굴, 시장 조사, Epic/Task",
    layer: "biz",
    package_type: "extension",
    version: "1.0.0",
    repo_url: "https://github.com/semicolon-devteam/semo.git",
    source_path: "semo-system/biz/discovery",
    detect_files: [],
    depends_on: [],
    aliases: ["discovery"],
    is_active: true,
    is_required: false,
    install_order: 100,
  },
  {
    id: "biz-design",
    name: "biz/design",
    display_name: "Design",
    description: "컨셉 설계, 목업, UX",
    layer: "biz",
    package_type: "extension",
    version: "1.0.0",
    repo_url: "https://github.com/semicolon-devteam/semo.git",
    source_path: "semo-system/biz/design",
    detect_files: [],
    depends_on: [],
    aliases: ["design"],
    is_active: true,
    is_required: false,
    install_order: 101,
  },
  {
    id: "biz-management",
    name: "biz/management",
    display_name: "Management",
    description: "일정/인력/스프린트 관리",
    layer: "biz",
    package_type: "extension",
    version: "1.0.0",
    repo_url: "https://github.com/semicolon-devteam/semo.git",
    source_path: "semo-system/biz/management",
    detect_files: [],
    depends_on: [],
    aliases: ["management"],
    is_active: true,
    is_required: false,
    install_order: 102,
  },
  {
    id: "biz-poc",
    name: "biz/poc",
    display_name: "PoC",
    description: "빠른 PoC, 패스트트랙",
    layer: "biz",
    package_type: "extension",
    version: "1.0.0",
    repo_url: "https://github.com/semicolon-devteam/semo.git",
    source_path: "semo-system/biz/poc",
    detect_files: [],
    depends_on: [],
    aliases: ["poc", "mvp"],
    is_active: true,
    is_required: false,
    install_order: 103,
  },

  // Engineering Layer
  {
    id: "eng-nextjs",
    name: "eng/nextjs",
    display_name: "Next.js",
    description: "Next.js 프론트엔드 개발",
    layer: "eng",
    package_type: "extension",
    version: "1.0.0",
    repo_url: "https://github.com/semicolon-devteam/semo.git",
    source_path: "semo-system/eng/nextjs",
    detect_files: ["next.config.js", "next.config.mjs", "next.config.ts"],
    depends_on: [],
    aliases: ["nextjs", "next"],
    is_active: true,
    is_required: false,
    install_order: 110,
  },
  {
    id: "eng-spring",
    name: "eng/spring",
    display_name: "Spring",
    description: "Spring Boot 백엔드 개발",
    layer: "eng",
    package_type: "extension",
    version: "1.0.0",
    repo_url: "https://github.com/semicolon-devteam/semo.git",
    source_path: "semo-system/eng/spring",
    detect_files: ["pom.xml", "build.gradle"],
    depends_on: [],
    aliases: ["spring", "backend"],
    is_active: true,
    is_required: false,
    install_order: 111,
  },
  {
    id: "eng-ms",
    name: "eng/ms",
    display_name: "Microservice",
    description: "마이크로서비스 아키텍처",
    layer: "eng",
    package_type: "extension",
    version: "1.0.0",
    repo_url: "https://github.com/semicolon-devteam/semo.git",
    source_path: "semo-system/eng/ms",
    detect_files: [],
    depends_on: [],
    aliases: ["ms"],
    is_active: true,
    is_required: false,
    install_order: 112,
  },
  {
    id: "eng-infra",
    name: "eng/infra",
    display_name: "Infra",
    description: "인프라/배포 관리",
    layer: "eng",
    package_type: "extension",
    version: "1.0.0",
    repo_url: "https://github.com/semicolon-devteam/semo.git",
    source_path: "semo-system/eng/infra",
    detect_files: ["docker-compose.yml", "Dockerfile"],
    depends_on: [],
    aliases: ["infra"],
    is_active: true,
    is_required: false,
    install_order: 113,
  },

  // Operations Layer
  {
    id: "ops-qa",
    name: "ops/qa",
    display_name: "QA",
    description: "테스트/품질 관리",
    layer: "ops",
    package_type: "extension",
    version: "1.0.0",
    repo_url: "https://github.com/semicolon-devteam/semo.git",
    source_path: "semo-system/ops/qa",
    detect_files: [],
    depends_on: [],
    aliases: ["qa"],
    is_active: true,
    is_required: false,
    install_order: 120,
  },
  {
    id: "ops-monitor",
    name: "ops/monitor",
    display_name: "Monitor",
    description: "서비스 현황 모니터링",
    layer: "ops",
    package_type: "extension",
    version: "1.0.0",
    repo_url: "https://github.com/semicolon-devteam/semo.git",
    source_path: "semo-system/ops/monitor",
    detect_files: [],
    depends_on: [],
    aliases: ["monitor"],
    is_active: true,
    is_required: false,
    install_order: 121,
  },
  {
    id: "ops-improve",
    name: "ops/improve",
    display_name: "Improve",
    description: "개선 제안",
    layer: "ops",
    package_type: "extension",
    version: "1.0.0",
    repo_url: "https://github.com/semicolon-devteam/semo.git",
    source_path: "semo-system/ops/improve",
    detect_files: [],
    depends_on: [],
    aliases: ["improve"],
    is_active: true,
    is_required: false,
    install_order: 122,
  },

  // Meta Layer
  {
    id: "meta",
    name: "meta",
    display_name: "Meta",
    description: "SEMO 프레임워크 자체 개발/관리",
    layer: "meta",
    package_type: "extension",
    version: "3.8.0",
    repo_url: "https://github.com/semicolon-devteam/semo.git",
    source_path: "semo-system/meta",
    detect_files: ["semo-core", "semo-skills"],
    depends_on: [],
    aliases: [],
    is_active: true,
    is_required: false,
    install_order: 200,
  },

  // System Layer
  {
    id: "sys-hooks",
    name: "semo-hooks",
    display_name: "Hooks",
    description: "Claude Code Hooks 기반 로깅 시스템",
    layer: "system",
    package_type: "extension",
    version: "1.0.0",
    repo_url: "https://github.com/semicolon-devteam/semo.git",
    source_path: "semo-system/semo-hooks",
    detect_files: [],
    depends_on: [],
    aliases: ["hooks"],
    is_active: true,
    is_required: false,
    install_order: 210,
  },
  {
    id: "sys-remote",
    name: "semo-remote",
    display_name: "Remote",
    description: "Claude Code 원격 제어 (모바일 PWA)",
    layer: "system",
    package_type: "extension",
    version: "1.0.0",
    repo_url: "https://github.com/semicolon-devteam/semo.git",
    source_path: "semo-system/semo-remote",
    detect_files: [],
    depends_on: [],
    aliases: ["remote"],
    is_active: true,
    is_required: false,
    install_order: 211,
  },
];

function getFallbackPackages(layer?: string): PackageDefinition[] {
  if (layer) {
    return FALLBACK_PACKAGES.filter((p) => p.layer === layer);
  }
  return FALLBACK_PACKAGES;
}

function resolveFallbackPackageName(input: string): string | null {
  // 1. 정확한 이름 매칭
  const exactMatch = FALLBACK_PACKAGES.find((p) => p.name === input);
  if (exactMatch) return exactMatch.name;

  // 2. 별칭 매칭
  const aliasMatch = FALLBACK_PACKAGES.find((p) => p.aliases.includes(input));
  if (aliasMatch) return aliasMatch.name;

  return null;
}

// ============================================================
// 유틸리티
// ============================================================

/**
 * 패키지 정보를 CLI 포맷으로 변환
 */
export function toExtensionPackageFormat(
  pkg: PackageDefinition
): { name: string; desc: string; detect: string[]; layer: string } {
  return {
    name: pkg.display_name,
    desc: pkg.description || "",
    detect: pkg.detect_files,
    layer: pkg.layer,
  };
}

/**
 * 별칭 매핑 객체 생성 (SHORTNAME_MAPPING 대체)
 */
export async function buildShortnameMappingFromDb(): Promise<
  Record<string, string>
> {
  const packages = await getPackages();
  const mapping: Record<string, string> = {};

  for (const pkg of packages) {
    for (const alias of pkg.aliases) {
      mapping[alias] = pkg.name;
    }
  }

  return mapping;
}

/**
 * EXTENSION_PACKAGES 형태의 객체 생성 (호환성용)
 */
export async function buildExtensionPackagesFromDb(): Promise<
  Record<string, { name: string; desc: string; detect: string[]; layer: string }>
> {
  const packages = await getExtensionPackages();
  const result: Record<
    string,
    { name: string; desc: string; detect: string[]; layer: string }
  > = {};

  for (const pkg of packages) {
    result[pkg.name] = toExtensionPackageFormat(pkg);
  }

  return result;
}
