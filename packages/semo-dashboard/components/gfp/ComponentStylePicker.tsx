'use client';

import { useState, useCallback } from 'react';

interface ComponentStylePickerProps {
  content: string;
  sectionId: string;
  gfpId: string;
  onStyleSelected?: (styleKey: string) => void;
}

interface StylePreset {
  key: string;
  label: string;
  description: string;
  buttonClass: string;
  cardClass: string;
  inputClass: string;
}

const STYLE_PRESETS: StylePreset[] = [
  {
    key: 'square-minimal',
    label: '스퀘어 미니멀',
    description: '직선적이고 깔끔한 스타일',
    buttonClass: 'px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-none',
    cardClass: 'bg-white border border-gray-200 p-4 rounded-none shadow-none',
    inputClass: 'border border-gray-300 px-3 py-2 text-sm rounded-none',
  },
  {
    key: 'rounded-friendly',
    label: '라운드 프렌들리',
    description: '부드럽고 친근한 느낌',
    buttonClass: 'px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-full',
    cardClass: 'bg-white border border-gray-200 p-5 rounded-2xl shadow-sm',
    inputClass: 'border border-gray-300 px-4 py-2.5 text-sm rounded-full',
  },
  {
    key: 'glass-premium',
    label: '글래스 프리미엄',
    description: '투명감 있는 고급 스타일',
    buttonClass: 'px-5 py-2.5 text-white text-sm font-medium rounded-xl bg-white/20 backdrop-blur-md border border-white/30',
    cardClass: 'bg-white/10 backdrop-blur-lg border border-white/20 p-5 rounded-2xl shadow-lg',
    inputClass: 'bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2.5 text-sm rounded-xl text-white placeholder-white/50',
  },
  {
    key: 'soft-shadow',
    label: '소프트 섀도',
    description: '은은한 그림자로 깊이감',
    buttonClass: 'px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg shadow-md shadow-blue-600/30 hover:shadow-lg',
    cardClass: 'bg-white p-5 rounded-xl shadow-lg shadow-gray-200/50 border-0',
    inputClass: 'border-0 shadow-inner bg-gray-50 px-4 py-2.5 text-sm rounded-lg',
  },
];

/**
 * 컴포넌트 스타일 시각적 비교 & 선택 피커.
 * 버튼, 카드, 인풋 각각의 실물 미리보기를 스타일별로 렌더링.
 */
export default function ComponentStylePicker({
  sectionId,
  gfpId,
  onStyleSelected,
}: ComponentStylePickerProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSelect = useCallback(async (key: string) => {
    setSelected(key);
    onStyleSelected?.(key);

    // 선택 결과를 section에 저장
    setSaving(true);
    try {
      await fetch(`/api/gfp/${gfpId}/sections`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: sectionId,
          metadata_patch: { selected_style: key },
        }),
      });
    } catch {
      // silent — 선택은 UI에 즉시 반영됨
    } finally {
      setSaving(false);
    }
  }, [sectionId, gfpId, onStyleSelected]);

  return (
    <div className="space-y-6">
      {/* Button Styles */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          버튼 스타일
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STYLE_PRESETS.map((preset) => (
            <button
              key={`btn-${preset.key}`}
              onClick={() => handleSelect(preset.key)}
              className={`relative p-4 rounded-xl border-2 transition-all ${
                selected === preset.key
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 ring-2 ring-blue-500/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {/* Selection indicator */}
              {selected === preset.key && (
                <span className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </span>
              )}

              {/* Preview area */}
              <div className={`min-h-[80px] flex items-center justify-center rounded-lg mb-3 ${
                preset.key === 'glass-premium'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 p-4'
                  : 'bg-gray-50 dark:bg-gray-800 p-4'
              }`}>
                <span className={preset.buttonClass}>
                  확인
                </span>
              </div>

              {/* Label */}
              <span className="block text-xs font-medium text-gray-900 dark:text-white">
                {preset.label}
              </span>
              <span className="block text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                {preset.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Card Styles */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          카드 스타일
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STYLE_PRESETS.map((preset) => (
            <div
              key={`card-${preset.key}`}
              className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                selected === preset.key
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
              onClick={() => handleSelect(preset.key)}
            >
              <div className={`min-h-[100px] ${
                preset.key === 'glass-premium'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 p-3 rounded-lg'
                  : 'p-3'
              }`}>
                <div className={preset.cardClass}>
                  <div className="text-xs font-medium text-gray-900 dark:text-white mb-1">
                    카드 제목
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    본문 텍스트 미리보기
                  </div>
                </div>
              </div>
              <span className="block text-[10px] text-center text-gray-500 dark:text-gray-400 mt-2">
                {preset.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Input Styles */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          인풋 스타일
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STYLE_PRESETS.map((preset) => (
            <div
              key={`input-${preset.key}`}
              className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                selected === preset.key
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
              onClick={() => handleSelect(preset.key)}
            >
              <div className={`min-h-[60px] flex items-center ${
                preset.key === 'glass-premium'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 p-3 rounded-lg'
                  : 'p-3'
              }`}>
                <input
                  type="text"
                  readOnly
                  placeholder="이메일 주소"
                  className={`${preset.inputClass} w-full pointer-events-none`}
                />
              </div>
              <span className="block text-[10px] text-center text-gray-500 dark:text-gray-400 mt-2">
                {preset.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Status */}
      {saving && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          선택 저장 중...
        </p>
      )}
      {selected && !saving && (
        <p className="text-xs text-green-600 dark:text-green-400 text-center">
          「{STYLE_PRESETS.find((p) => p.key === selected)?.label}」 스타일이 선택되었습니다
        </p>
      )}
    </div>
  );
}
