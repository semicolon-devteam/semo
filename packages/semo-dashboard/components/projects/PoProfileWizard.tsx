'use client';

import { useState } from 'react';
import type {
  PoProfile,
  PoTechLevel,
  PoDesignSensitivity,
  PoDomainArea,
  PoInteractionStyle,
  PoDecisionStyle,
} from '@/types';

interface PoProfileWizardProps {
  onComplete: (profile: PoProfile) => void;
  onBack: () => void;
}

// ── Question definitions ──

interface QuestionOption<T extends string> {
  value: T;
  label: string;
  description: string;
  icon: string;
}

interface QuestionDef<T extends string> {
  key: string;
  title: string;
  subtitle: string;
  options: QuestionOption<T>[];
}

const QUESTIONS: QuestionDef<string>[] = [
  {
    key: 'tech_level',
    title: '개발/코딩 경험이 어느 정도인가요?',
    subtitle: '파이프라인의 기술적 상세 수준을 조절합니다',
    options: [
      {
        value: 'non-technical',
        label: '비개발자',
        description: '코딩 경험이 없거나 거의 없어요',
        icon: '🌱',
      },
      { value: 'basic', label: '기본', description: 'HTML/CSS 정도는 읽을 수 있어요', icon: '🌿' },
      {
        value: 'intermediate',
        label: '중급',
        description: '프레임워크를 사용해본 적 있어요',
        icon: '🌳',
      },
      { value: 'advanced', label: '고급', description: '풀스택 개발이 가능해요', icon: '🏔️' },
    ],
  },
  {
    key: 'design_sensitivity',
    title: '디자인에 대한 관심도는?',
    subtitle: '디자인 단계에서 얼마나 세밀하게 조율할지 결정합니다',
    options: [
      { value: 'low', label: '작동만 하면 OK', description: '깔끔하게만 해주세요', icon: '⚡' },
      {
        value: 'medium',
        label: '적당히 신경 쓰고 싶어요',
        description: '주요 스타일은 직접 고르고 싶어요',
        icon: '🎨',
      },
      {
        value: 'high',
        label: '디테일까지 직접 조율',
        description: '자간, 행간, 그리드까지 신경 써요',
        icon: '✨',
      },
    ],
  },
  {
    key: 'domain_area',
    title: '주 전문 분야는?',
    subtitle: '각 페이즈에서 강조할 영역을 맞춤 설정합니다',
    options: [
      {
        value: 'business',
        label: '비즈니스/마케팅',
        description: '시장, 수익 모델, 고객 확보',
        icon: '📊',
      },
      {
        value: 'engineering',
        label: '엔지니어링',
        description: '아키텍처, 코드, 인프라',
        icon: '⚙️',
      },
      { value: 'design', label: '디자인', description: 'UI/UX, 브랜딩, 비주얼', icon: '🎯' },
      {
        value: 'product',
        label: '프로덕트 기획',
        description: '기능 정의, 우선순위, 로드맵',
        icon: '🗺️',
      },
    ],
  },
  {
    key: 'interaction_style',
    title: '진행 방식 선호는?',
    subtitle: '각 페이즈의 설명 깊이를 조절합니다',
    options: [
      {
        value: 'concise',
        label: '핵심만 간결하게',
        description: '결론 위주로, 배경 설명은 최소화',
        icon: '🎯',
      },
      {
        value: 'detailed',
        label: '맥락과 함께 상세하게',
        description: '왜 이렇게 했는지 설명도 함께',
        icon: '📖',
      },
    ],
  },
  {
    key: 'decision_style',
    title: '선택지 제시 방식은?',
    subtitle: '봇이 결과물을 어떻게 제안할지 결정합니다',
    options: [
      {
        value: 'options',
        label: '여러 옵션 보여줘',
        description: '비교하고 직접 골라볼게요',
        icon: '🔀',
      },
      {
        value: 'recommendation',
        label: '추천안 하나만 줘',
        description: '전문가 판단에 맡길게요',
        icon: '👆',
      },
    ],
  },
];

// ── Weight labels for summary ──
const LABELS: Record<string, Record<string, string>> = {
  tech_level: {
    'non-technical': '비개발자',
    basic: '기본',
    intermediate: '중급',
    advanced: '고급',
  },
  design_sensitivity: { low: '실용 우선', medium: '적당히 꼼꼼', high: '디테일 장인' },
  domain_area: {
    business: '비즈니스',
    engineering: '엔지니어링',
    design: '디자인',
    product: '프로덕트',
  },
  interaction_style: { concise: '간결', detailed: '상세' },
  decision_style: { options: '선택지 비교', recommendation: '추천안' },
};

export default function PoProfileWizard({ onComplete, onBack }: PoProfileWizardProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [animating, setAnimating] = useState(false);

  const totalSteps = QUESTIONS.length;
  const isComplete = step >= totalSteps;
  const currentQuestion = QUESTIONS[step];

  function selectOption(value: string) {
    if (animating) return;
    const key = currentQuestion.key;
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => s + 1);
      setAnimating(false);
    }, 300);
  }

  function handleConfirm() {
    onComplete({
      tech_level: (answers.tech_level ?? 'intermediate') as PoTechLevel,
      design_sensitivity: (answers.design_sensitivity ?? 'medium') as PoDesignSensitivity,
      domain_area: (answers.domain_area ?? 'product') as PoDomainArea,
      interaction_style: (answers.interaction_style ?? 'detailed') as PoInteractionStyle,
      decision_style: (answers.decision_style ?? 'options') as PoDecisionStyle,
    });
  }

  function goBack() {
    if (step === 0) {
      onBack();
    } else {
      setStep((s) => s - 1);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">PO 프로필 설정</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          파이프라인을 당신에게 맞게 조율합니다
        </p>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5 mb-8">
        {QUESTIONS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i < step
                ? 'bg-blue-500'
                : i === step && !isComplete
                  ? 'bg-blue-300 dark:bg-blue-700'
                  : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>

      {/* Question Card or Summary */}
      {!isComplete ? (
        <div
          className={`transition-all duration-300 ${
            animating ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
          }`}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">
              {step + 1} / {totalSteps}
            </p>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
              {currentQuestion.title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {currentQuestion.subtitle}
            </p>

            <div className="space-y-3">
              {currentQuestion.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => selectOption(opt.value)}
                  className={`w-full text-left px-4 py-3.5 rounded-lg border-2 transition-all hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 ${
                    answers[currentQuestion.key] === opt.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{opt.icon}</span>
                    <div>
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">
                        {opt.label}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {opt.description}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Back */}
          <div className="mt-4">
            <button
              onClick={goBack}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              ← {step === 0 ? '기본정보로 돌아가기' : '이전 질문'}
            </button>
          </div>
        </div>
      ) : (
        /* Summary Card */
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            당신의 프로필
          </h2>

          <div className="space-y-3 mb-6">
            {QUESTIONS.map((q) => {
              const val = answers[q.key] ?? '';
              const label = LABELS[q.key]?.[val] ?? val;
              return (
                <div
                  key={q.key}
                  className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {q.title.replace('?', '').replace('는', '')}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
            이 설정은 나중에 프로젝트 설정에서 변경할 수 있습니다
          </p>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(0)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              ← 다시 설정하기
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              프로젝트 생성
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
