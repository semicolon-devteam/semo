/**
 * Feature Extractor — Phase 5(에픽) / Phase 6(기능 스펙) 완료 시
 * 승인된 섹션에서 기능을 추출하여 KB feature/* 엔트리로 자동 등록
 */

import { createFeature, updateFeature, listFeatures } from './service';
import { normalizeSpec, mergeSpecs, nextAcId, nextUsId, nextTsId } from './feature-spec';
import type {
  ServiceSection,
  ServiceProject,
  FeatureSpec,
  AcceptanceCriterion,
  UserStory,
  TestScenario,
} from '@/types';

export async function extractAndCreateFeaturesFromPhase(
  serviceId: string,
  phase: number,
  sections: ServiceSection[],
  project: ServiceProject,
): Promise<{ created: number; enriched: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  let enriched = 0;

  const existing = await listFeatures(serviceId);
  const existingNames = new Map(existing.map((f) => [f.name.toLowerCase(), f]));

  for (const section of sections) {
    try {
      if (phase === 5) {
        // Phase 5 (에픽): 섹션 1개 = 기능 1개
        const name = extractFeatureName(section);
        const description = extractDescription(section.content);
        const category = inferCategory(section.content);

        if (existingNames.has(name.toLowerCase())) {
          // 이미 존재하면 스킵
          continue;
        }

        await createFeature({
          service_id: serviceId,
          name,
          description,
          category,
          status: 'planned',
          metadata: {
            source_phase: 5,
            section_id: section.section_id,
            section_key: section.section_key,
            epic_markdown: section.content,
          },
        });
        created++;
      } else if (phase === 6) {
        // Phase 6 (기능 스펙): 기존 feature 매칭 → spec 보강
        const name = extractFeatureName(section);
        const existingFeature = existingNames.get(name.toLowerCase());
        const spec = extractSpecFromContent(section.content);

        if (existingFeature) {
          // 기존 feature에 spec 보강
          const currentSpec = normalizeSpec(existingFeature.metadata?.spec);
          const merged = mergeSpecs(currentSpec, {
            ...spec,
            spec_status: 'approved',
            spec_generated_by: 'gfp-phase6',
            spec_generated_at: new Date().toISOString(),
          });
          await updateFeature(existingFeature.feature_id, {
            metadata: { spec: merged, source_phase_6: section.section_id },
          });
          enriched++;
        } else {
          // 신규 feature + spec 동시 생성
          await createFeature({
            service_id: serviceId,
            name,
            description: spec.summary || extractDescription(section.content),
            category: inferCategory(section.content),
            status: 'planned',
            metadata: {
              source_phase: 6,
              section_id: section.section_id,
              section_key: section.section_key,
              spec: {
                ...spec,
                spec_status: 'approved',
                spec_generated_by: 'gfp-phase6',
                spec_generated_at: new Date().toISOString(),
              },
            },
          });
          created++;
        }
      }
    } catch (err) {
      errors.push(
        `Section ${section.section_key}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(
    `[Feature Extractor] Phase ${phase}: created ${created}, enriched ${enriched}${errors.length > 0 ? `, ${errors.length} errors` : ''}`,
  );

  return { created, enriched, errors };
}

// ── 헬퍼 함수 ──

function extractFeatureName(section: ServiceSection): string {
  // 섹션 제목에서 기능명 추출 (에픽 번호 등 제거)
  let name = section.title;
  // "Epic 1: 포트폴리오" → "포트폴리오"
  name = name.replace(/^(?:Epic|에픽)\s*\d*\s*[:\-—]\s*/i, '');
  // "📋 포트폴리오" → "포트폴리오"
  name = name.replace(/^[📋🎯⚠️📊👤]\s*/, '');
  return name.trim() || section.title;
}

function extractDescription(content: string): string {
  // Problem Statement 또는 첫 문단 추출
  const lines = content.split('\n');

  // "Problem Statement" 또는 "문제 정의" 섹션 찾기
  let inProblem = false;
  const problemLines: string[] = [];
  for (const line of lines) {
    if (/problem\s*statement|문제\s*정의|현재\s*상황/i.test(line)) {
      inProblem = true;
      continue;
    }
    if (inProblem) {
      if (line.startsWith('##') || line.startsWith('---')) break;
      if (line.trim()) problemLines.push(line.trim());
    }
  }
  if (problemLines.length > 0) return problemLines.join(' ').slice(0, 500);

  // 폴백: 첫 번째 비-헤더 문단
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('|') || t.startsWith('---')) continue;
    if (t.startsWith('-') && t.length < 10) continue;
    return t.slice(0, 500);
  }
  return '';
}

function inferCategory(content: string): string {
  const lower = content.toLowerCase();
  if (/인프라|cicd|배포|서버|데이터베이스|api|인증|로그인/.test(lower)) return 'infra';
  if (/디자인|ui|ux|접근성|반응형|다크모드|애니메이션/.test(lower)) return 'ux';
  if (/마케팅|seo|광고|분석|트래킹|공유|바이럴/.test(lower)) return 'growth';
  if (/연동|외부|oauth|결제|알림|푸시|웹훅/.test(lower)) return 'integration';
  return 'core';
}

function extractSpecFromContent(content: string): Partial<FeatureSpec> {
  const spec: Partial<FeatureSpec> = {
    acceptance_criteria: [],
    user_stories: [],
    test_scenarios: [],
  };

  const lines = content.split('\n');
  let currentSection = '';

  // 요약 추출 (첫 문단)
  spec.summary = extractDescription(content);

  // 규모 추출
  const effortMatch = content.match(
    /(?:예상\s*규모|estimated?\s*effort)\s*[:\-—]\s*(small|medium|large)/i,
  );
  if (effortMatch)
    spec.estimated_effort = effortMatch[1].toLowerCase() as FeatureSpec['estimated_effort'];

  for (const line of lines) {
    const t = line.trim();

    // 섹션 감지
    if (/수용\s*기준|acceptance\s*criteria/i.test(t)) {
      currentSection = 'ac';
      continue;
    }
    if (/유저\s*스토리|user\s*stor/i.test(t)) {
      currentSection = 'us';
      continue;
    }
    if (/테스트\s*시나리오|test\s*scenario/i.test(t)) {
      currentSection = 'ts';
      continue;
    }
    if (t.startsWith('##')) {
      currentSection = '';
      continue;
    }

    // AC 파싱: - [ ] 항목 or - 항목
    if (currentSection === 'ac') {
      const acMatch = t.match(/^-\s*(?:\[[ x]\]\s*)?(.+)/);
      if (acMatch && acMatch[1].length > 5) {
        spec.acceptance_criteria!.push({
          id: nextAcId(spec.acceptance_criteria!),
          criterion: acMatch[1].trim(),
          verified: false,
        });
      }
    }

    // 유저 스토리 파싱: As a X, I want Y, so that Z
    if (currentSection === 'us') {
      const usMatch = t.match(
        /(?:As\s+a|로서|으로서)\s+(.+?)(?:,\s*I\s+want|,\s*(.+?)(?:하고\s*싶|원))/i,
      );
      if (usMatch) {
        spec.user_stories!.push({
          id: nextUsId(spec.user_stories!),
          as_a: usMatch[1].trim(),
          i_want: usMatch[2]?.trim() || '',
          so_that: '',
          acceptance_ids: [],
        });
      }
    }
  }

  return spec;
}
