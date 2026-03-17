/**
 * Supabase Singleton Client
 *
 * 모든 컴포넌트와 훅에서 단일 Supabase 클라이언트 인스턴스를 공유합니다.
 * "Multiple GoTrueClient instances detected" 경고를 방지합니다.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 싱글톤 인스턴스
let supabaseInstance: SupabaseClient | null = null;

/**
 * Supabase 클라이언트 싱글톤을 반환합니다.
 * 서버 사이드에서는 매번 새 인스턴스를 생성하고,
 * 클라이언트 사이드에서는 단일 인스턴스를 재사용합니다.
 */
export function getSupabaseClient(): SupabaseClient {
  // 서버 사이드에서는 매번 새 인스턴스 생성 (SSR 호환)
  if (typeof window === 'undefined') {
    return createClient(supabaseUrl, supabaseKey);
  }

  // 클라이언트 사이드에서는 싱글톤 사용
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }

  return supabaseInstance;
}

// 편의를 위한 기본 내보내기
export const supabase = typeof window !== 'undefined'
  ? getSupabaseClient()
  : null as unknown as SupabaseClient; // SSR에서는 lazy 초기화 필요
