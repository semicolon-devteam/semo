'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/provider';

type Step = 'role' | 'select';
type Role = 'team-member' | 'incubator-participant';

interface TeamMember {
  domain: string;
  nickname: string | null;
  realName: string | null;
  label: string;
}

interface IncubatorProject {
  serviceId: string;
  projectName: string;
  serviceDomain: string;
}

export default function OnboardingPage() {
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<Role | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<IncubatorProject[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이미 승인된 사용자는 대시보드로
  useEffect(() => {
    if (authLoading || !profile) return;
    if (isAdmin || profile.onboarding_status === 'approved') {
      router.replace('/');
    } else if (profile.onboarding_status === 'pending') {
      router.replace('/onboarding/pending');
    }
  }, [authLoading, profile, isAdmin, router]);

  function handleRoleSelect(r: Role) {
    setRole(r);
    setStep('select');
    setError(null);
    setOptionsLoading(true);
    fetch('/api/onboarding/options')
      .then((res) => res.json())
      .then((data) => {
        setTeamMembers(data.teamMembers || []);
        setProjects(data.incubatorProjects || []);
      })
      .catch(() => setError('옵션을 불러오지 못했습니다.'))
      .finally(() => setOptionsLoading(false));
  }

  async function handleSubmit() {
    if (!role) return;
    if (role === 'team-member' && !selectedDomain) {
      setError('팀 멤버를 선택해주세요.');
      return;
    }
    if (role === 'incubator-participant' && !selectedServiceId) {
      setError('프로젝트를 선택해주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          domain: role === 'team-member' ? selectedDomain : undefined,
          serviceId: role === 'incubator-participant' ? selectedServiceId : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || '제출에 실패했습니다.');
        return;
      }
      // full reload로 AuthProvider 상태 초기화 후 pending 페이지로
      window.location.href = '/onboarding/pending';
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900 dark:text-white">
          SemiColony 대시보드 가입
        </h1>
        <p className="mb-8 text-center text-sm text-gray-500 dark:text-gray-400">
          {step === 'role' ? '어떤 유형의 사용자인가요?' : '본인 정보를 선택해주세요.'}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Step 1: Role Selection */}
        {step === 'role' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={() => handleRoleSelect('team-member')}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-gray-200 p-6 transition hover:border-blue-500 hover:bg-blue-50 dark:border-gray-600 dark:hover:border-blue-400 dark:hover:bg-blue-900/20"
            >
              <span className="text-3xl">👥</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">팀 멤버</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">세미콜론 팀 구성원</span>
            </button>
            <button
              onClick={() => handleRoleSelect('incubator-participant')}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-gray-200 p-6 transition hover:border-green-500 hover:bg-green-50 dark:border-gray-600 dark:hover:border-green-400 dark:hover:bg-green-900/20"
            >
              <span className="text-3xl">🚀</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                인큐베이터 참여자
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">프로젝트 외부 참여자</span>
            </button>
          </div>
        )}

        {/* Step 2: Entity Selection */}
        {step === 'select' && (
          <div>
            <button
              onClick={() => {
                setStep('role');
                setRole(null);
                setSelectedDomain('');
                setSelectedServiceId('');
                setError(null);
              }}
              className="mb-4 text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              ← 역할 다시 선택
            </button>

            {optionsLoading ? (
              <div className="py-8 text-center text-gray-400">불러오는 중...</div>
            ) : role === 'team-member' ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  본인을 선택하세요
                </label>
                {teamMembers.length === 0 ? (
                  <p className="text-sm text-gray-500">선택 가능한 팀 멤버가 없습니다.</p>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {teamMembers.map((m) => (
                      <button
                        key={m.domain}
                        onClick={() => setSelectedDomain(m.domain)}
                        className={`w-full rounded-lg border-2 p-3 text-left transition ${
                          selectedDomain === m.domain
                            ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                            : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
                        }`}
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{m.label}</span>
                        {m.realName && m.nickname && (
                          <span className="ml-2 text-sm text-gray-500">({m.realName})</span>
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => setSelectedDomain('__other__')}
                      className={`w-full rounded-lg border-2 border-dashed p-3 text-left transition ${
                        selectedDomain === '__other__'
                          ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                          : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
                      }`}
                    >
                      <span className="text-gray-500 dark:text-gray-400">기타 (목록에 없음)</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  참여 프로젝트를 선택하세요
                </label>
                {projects.length === 0 ? (
                  <p className="text-sm text-gray-500">등록된 프로젝트가 없습니다.</p>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {projects.map((p) => (
                      <button
                        key={p.serviceId}
                        onClick={() => setSelectedServiceId(p.serviceId)}
                        className={`w-full rounded-lg border-2 p-3 text-left transition ${
                          selectedServiceId === p.serviceId
                            ? 'border-green-500 bg-green-50 dark:border-green-400 dark:bg-green-900/20'
                            : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
                        }`}
                      >
                        <span className="font-medium text-gray-900 dark:text-white">
                          {p.projectName}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">{p.serviceDomain}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={
                submitting ||
                (role === 'team-member' && !selectedDomain) ||
                (role === 'incubator-participant' && !selectedServiceId)
              }
              className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? '제출 중...' : '가입 신청'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
