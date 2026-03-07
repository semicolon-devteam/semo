# 랜드 계정 연동 & 포인트 교환소 UI 디자인 시안

> 작성자: DesignClaw  
> 작성일: 2026-03-01  
> 버전: v1.0  
> 기획: PlanClaw  
> 대상: 게임랜드, 플레이랜드, 오피스랜드 공통 UI

---

## 🎨 디자인 원칙

1. **모바일 우선 반응형**: 작은 화면에서 완벽하게 동작, 큰 화면으로 자연스럽게 확장
2. **일관성**: 3개 서비스에서 동일한 UI/UX 제공
3. **명확성**: 상태(연동/미연동, 성공/실패)를 시각적으로 즉시 구분
4. **친절함**: 모든 액션에 명확한 피드백 제공
5. **신뢰감**: 금전 관련 액션은 확인 단계 필수

---

## 🎨 컬러 시스템

```typescript
// 상태별 색상 (TailwindCSS)
const STATUS_COLORS = {
  linked: "bg-green-50 border-green-200 text-green-700",
  unlinked: "bg-gray-50 border-gray-200 text-gray-600",
  success: "bg-green-500",
  error: "bg-red-500",
  warning: "bg-yellow-500",
  processing: "bg-blue-500",
};

const BUTTON_VARIANTS = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white",
  secondary: "bg-gray-100 hover:bg-gray-200 text-gray-700",
  danger: "bg-red-600 hover:bg-red-700 text-white",
};
```

---

## 📱 1. 계정 연동 페이지

### 1.1 서비스 카드 목록 (AccountLinkingPage)

```tsx
// pages/mypage/account-linking.tsx
import React, { useState } from 'react';
import ServiceCard from '@/components/account-linking/ServiceCard';
import TokenDisplayModal from '@/components/account-linking/TokenDisplayModal';
import TokenInputModal from '@/components/account-linking/TokenInputModal';

interface LinkedService {
  id: string;
  name: string;
  icon: string;
  isLinked: boolean;
  linkedAt?: string;
}

const SERVICES: LinkedService[] = [
  { id: 'game-land', name: '게임랜드', icon: '🎮', isLinked: true, linkedAt: '2026-02-15 14:32' },
  { id: 'play-land', name: '플레이랜드', icon: '🎯', isLinked: false },
];

export default function AccountLinkingPage() {
  const [showTokenDisplay, setShowTokenDisplay] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const handleStartLinking = (serviceId: string) => {
    setSelectedService(serviceId);
    setShowTokenDisplay(true);
  };

  const handleContactAdmin = () => {
    // 어드민 채팅창 열기
    window.open('/admin-chat', '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">계정 연동 관리</h1>
          <p className="mt-2 text-sm text-gray-600">
            형제 서비스와 계정을 연동하여 포인트 교환 등의 기능을 이용하세요.
          </p>
        </div>

        {/* Service Cards */}
        <div className="space-y-4">
          {SERVICES.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onStartLinking={handleStartLinking}
              onContactAdmin={handleContactAdmin}
            />
          ))}
        </div>

        {/* Token Input Entry (독립적으로 접근 가능) */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 font-medium mb-3">
            다른 랜드 서비스에서 발급받은 연동 토큰이 있으신가요?
          </p>
          <button
            onClick={() => setShowTokenInput(true)}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            토큰으로 연동하기
          </button>
        </div>
      </div>

      {/* Modals */}
      {showTokenDisplay && (
        <TokenDisplayModal
          serviceName={SERVICES.find(s => s.id === selectedService)?.name || ''}
          onClose={() => setShowTokenDisplay(false)}
        />
      )}

      {showTokenInput && (
        <TokenInputModal
          onClose={() => setShowTokenInput(false)}
        />
      )}
    </div>
  );
}
```

### 1.2 서비스 카드 컴포넌트 (ServiceCard)

```tsx
// components/account-linking/ServiceCard.tsx
import React from 'react';

interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    icon: string;
    isLinked: boolean;
    linkedAt?: string;
  };
  onStartLinking: (serviceId: string) => void;
  onContactAdmin: () => void;
}

export default function ServiceCard({ service, onStartLinking, onContactAdmin }: ServiceCardProps) {
  const statusColor = service.isLinked
    ? 'bg-green-50 border-green-200'
    : 'bg-gray-50 border-gray-200';

  return (
    <div className={`p-5 border-2 rounded-xl transition-all ${statusColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{service.icon}</span>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{service.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {service.isLinked ? (
                <>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    ✅ 연동됨
                  </span>
                  <span className="text-xs text-gray-500">
                    {service.linkedAt}
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  ❌ 미연동
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-4">
        {service.isLinked ? (
          <button
            onClick={onContactAdmin}
            className="w-full px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            연동 해제 문의하기 →
          </button>
        ) : (
          <button
            onClick={() => onStartLinking(service.id)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            연동 시작하기 →
          </button>
        )}
      </div>
    </div>
  );
}
```

### 1.3 토큰 발급 모달 (TokenDisplayModal)

```tsx
// components/account-linking/TokenDisplayModal.tsx
import React, { useState, useEffect } from 'react';

interface TokenDisplayModalProps {
  serviceName: string;
  onClose: () => void;
}

export default function TokenDisplayModal({ serviceName, onClose }: TokenDisplayModalProps) {
  const [token, setToken] = useState('abc123-def456-ghi789-jkl012'); // API에서 받아옴
  const [copied, setCopied] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(15 * 60); // 15분

  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🔗</span>
          <h2 className="text-xl font-bold text-gray-900">{serviceName} 계정 연동</h2>
        </div>

        {/* Step Indicator */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">1단계: 연동 토큰 발급</p>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 leading-relaxed">
              아래 토큰을 복사한 후,<br />
              <strong>{serviceName}</strong>에서 "계정 연동" 메뉴로 이동하여<br />
              붙여넣기 해주세요.
            </p>
          </div>
        </div>

        {/* Token Display */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={token}
              readOnly
              className="w-full px-4 py-3 pr-24 border-2 border-gray-300 rounded-lg bg-gray-50 font-mono text-sm text-gray-900 select-all"
            />
            <button
              onClick={handleCopy}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              {copied ? '✓ 복사됨' : '📋 복사'}
            </button>
          </div>
        </div>

        {/* Timer */}
        <div className="mb-6 flex items-center justify-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <span className="text-yellow-700 text-sm">⏱️ 유효시간:</span>
          <span className="text-yellow-900 font-mono font-bold">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')} 남음
          </span>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
```

### 1.4 토큰 입력 모달 (TokenInputModal)

```tsx
// components/account-linking/TokenInputModal.tsx
import React, { useState } from 'react';

interface TokenInputModalProps {
  onClose: () => void;
}

export default function TokenInputModal({ onClose }: TokenInputModalProps) {
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // API 호출: POST /api/link/verify
      const response = await fetch('/api/link/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verification_token: token }),
      });

      if (response.ok) {
        // 성공 토스트 + 페이지 새로고침
        alert('✅ 계정이 연동되었습니다');
        window.location.reload();
      } else {
        // 실패 토스트
        alert('❌ 토큰이 유효하지 않습니다');
      }
    } catch (error) {
      alert('❌ 네트워크 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">계정 연동하기</h2>
          <p className="text-sm text-gray-600">
            다른 랜드 서비스에서 발급받은 연동 토큰을 입력해주세요.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              연동 토큰
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="abc123-def456-ghi789-jkl012"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-mono text-sm"
              required
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading || !token}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '처리 중...' : '연동하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## 💰 2. 포인트 교환 페이지

### 2.1 교환 폼 (PointExchangePage)

```tsx
// pages/mypage/point-exchange.tsx
import React, { useState } from 'react';
import ExchangeForm from '@/components/point-exchange/ExchangeForm';
import ConfirmModal from '@/components/point-exchange/ConfirmModal';

interface LinkedService {
  id: string;
  name: string;
  icon: string;
  isLinked: boolean;
  balance?: number;
}

const LINKED_SERVICES: LinkedService[] = [
  { id: 'play-land', name: '플레이랜드', icon: '🎯', isLinked: true, balance: 3200 },
  { id: 'office-land', name: '오피스랜드', icon: '🏢', isLinked: false },
];

export default function PointExchangePage() {
  const [currentBalance] = useState(12500); // 현재 서비스 보유 포인트
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleExchange = () => {
    setShowConfirm(true);
  };

  const handleConfirmExchange = async () => {
    // API 호출 + globalLoader
    try {
      const response = await fetch('/api/exchange/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_service_id: selectedService,
          source_amount: amount,
        }),
      });

      if (response.ok) {
        alert('✅ 교환이 완료되었습니다');
        window.location.reload();
      } else {
        alert('❌ 교환 처리 중 오류가 발생했습니다');
      }
    } catch (error) {
      alert('❌ 네트워크 오류가 발생했습니다');
    } finally {
      setShowConfirm(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">포인트 교환</h1>
          <p className="mt-2 text-sm text-gray-600">
            연동된 형제 서비스로 포인트를 전송할 수 있습니다.
          </p>
        </div>

        {/* Exchange Form */}
        <ExchangeForm
          currentBalance={currentBalance}
          linkedServices={LINKED_SERVICES}
          selectedService={selectedService}
          amount={amount}
          onSelectService={setSelectedService}
          onChangeAmount={setAmount}
          onExchange={handleExchange}
        />

        {/* History Link */}
        <div className="mt-6 text-center">
          <a
            href="/mypage/point-exchange/history"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            교환 내역 보기 →
          </a>
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && selectedService && (
        <ConfirmModal
          sourceService="게임랜드"
          targetService={LINKED_SERVICES.find(s => s.id === selectedService)?.name || ''}
          amount={amount}
          onConfirm={handleConfirmExchange}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
```

### 2.2 교환 폼 컴포넌트 (ExchangeForm)

```tsx
// components/point-exchange/ExchangeForm.tsx
import React from 'react';

interface ExchangeFormProps {
  currentBalance: number;
  linkedServices: {
    id: string;
    name: string;
    icon: string;
    isLinked: boolean;
    balance?: number;
  }[];
  selectedService: string | null;
  amount: number;
  onSelectService: (serviceId: string) => void;
  onChangeAmount: (amount: number) => void;
  onExchange: () => void;
}

export default function ExchangeForm({
  currentBalance,
  linkedServices,
  selectedService,
  amount,
  onSelectService,
  onChangeAmount,
  onExchange,
}: ExchangeFormProps) {
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    if (value <= currentBalance) {
      onChangeAmount(value);
    }
  };

  const handleMaxAmount = () => {
    onChangeAmount(currentBalance);
  };

  const exchangeRate = 1.0;
  const fee = 0;
  const expectedAmount = amount * exchangeRate - fee;

  const isValid = selectedService && amount > 0 && amount <= currentBalance;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Current Balance */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <p className="text-sm text-gray-600 mb-1">현재 보유 포인트</p>
        <p className="text-3xl font-bold text-gray-900">
          {currentBalance.toLocaleString()}P
        </p>
      </div>

      {/* Source Service */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          출발 서비스
        </label>
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎮</span>
            <span className="text-gray-900 font-medium">게임랜드 (현재 서비스)</span>
          </div>
        </div>
      </div>

      {/* Target Service Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          도착 서비스
        </label>
        <div className="space-y-3">
          {linkedServices.map((service) => (
            <button
              key={service.id}
              onClick={() => service.isLinked && onSelectService(service.id)}
              disabled={!service.isLinked}
              className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                selectedService === service.id
                  ? 'border-blue-500 bg-blue-50'
                  : service.isLinked
                  ? 'border-gray-200 hover:border-gray-300 bg-white'
                  : 'border-gray-200 bg-gray-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-6 h-6">
                    {selectedService === service.id ? (
                      <div className="w-4 h-4 rounded-full bg-blue-600"></div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300"></div>
                    )}
                  </div>
                  <span className="text-2xl">{service.icon}</span>
                  <div>
                    <p className="font-medium text-gray-900">{service.name}</p>
                    {service.isLinked ? (
                      <p className="text-sm text-gray-600">
                        연동됨 | 보유: {service.balance?.toLocaleString()}P
                      </p>
                    ) : (
                      <a
                        href="/mypage/account-linking"
                        className="text-sm text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        미연동 → 계정 연동하기
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Amount Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          교환 포인트
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={amount || ''}
            onChange={handleAmountChange}
            placeholder="교환할 포인트를 입력하세요"
            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            min="1"
            max={currentBalance}
          />
          <button
            onClick={handleMaxAmount}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            전액
          </button>
        </div>
        {amount > currentBalance && (
          <p className="mt-2 text-sm text-red-600">보유 포인트를 초과했습니다</p>
        )}
      </div>

      {/* Exchange Rate Summary */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">환율</span>
          <span className="text-gray-900 font-medium">1:1</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">수수료</span>
          <span className="text-gray-900 font-medium">0P</span>
        </div>
        <div className="pt-2 border-t border-gray-200 flex justify-between">
          <span className="text-gray-900 font-medium">수령 예정</span>
          <span className="text-xl font-bold text-blue-600">
            {expectedAmount.toLocaleString()}P
          </span>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={onExchange}
        disabled={!isValid}
        className="w-full px-4 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        교환하기 →
      </button>
    </div>
  );
}
```

### 2.3 최종 확인 모달 (ConfirmModal)

```tsx
// components/point-exchange/ConfirmModal.tsx
import React from 'react';

interface ConfirmModalProps {
  sourceService: string;
  targetService: string;
  amount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  sourceService,
  targetService,
  amount,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">교환 확인</h2>
          <p className="text-sm text-gray-600">
            아래 내용으로 교환하시겠습니까?
          </p>
        </div>

        {/* Summary */}
        <div className="mb-6 space-y-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs text-gray-600 mb-1">출발</p>
            <p className="text-lg font-bold text-gray-900">🎮 {sourceService}</p>
          </div>
          <div className="flex justify-center">
            <span className="text-2xl">↓</span>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">도착</p>
            <p className="text-lg font-bold text-gray-900">{targetService}</p>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-600 mb-1">교환 포인트</p>
            <p className="text-2xl font-bold text-blue-600">{amount.toLocaleString()}P</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">수령 포인트</p>
            <p className="text-2xl font-bold text-green-600">{amount.toLocaleString()}P</p>
          </div>
        </div>

        {/* Warning */}
        <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800">
            ⚠️ 교환 후에는 취소할 수 없습니다.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 📜 3. 교환 내역 페이지

### 3.1 내역 리스트 (ExchangeHistoryPage)

```tsx
// pages/mypage/point-exchange/history.tsx
import React, { useState, useEffect } from 'react';
import ExchangeHistoryList from '@/components/point-exchange/ExchangeHistoryList';
import Pagination from '@/components/common/Pagination';

interface ExchangeRecord {
  id: string;
  createdAt: string;
  sourceService: { id: string; name: string; icon: string };
  targetService: { id: string; name: string; icon: string };
  sourceAmount: number;
  targetAmount: number;
  status: 'SUCCESS' | 'FAILED' | 'PROCESSING';
}

export default function ExchangeHistoryPage() {
  const [records, setRecords] = useState<ExchangeRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  useEffect(() => {
    // API 호출: GET /api/exchange/history?page={page}&limit={limit}
    fetchHistory(page);
  }, [page]);

  const fetchHistory = async (page: number) => {
    try {
      const response = await fetch(`/api/exchange/history?page=${page}&limit=${limit}`);
      const data = await response.json();
      setRecords(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">교환 내역</h1>
          <p className="mt-2 text-sm text-gray-600">
            총 {total}건의 교환 내역이 있습니다.
          </p>
        </div>

        {/* History List */}
        <ExchangeHistoryList records={records} />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

### 3.2 내역 리스트 컴포넌트 (ExchangeHistoryList)

```tsx
// components/point-exchange/ExchangeHistoryList.tsx
import React from 'react';

interface ExchangeRecord {
  id: string;
  createdAt: string;
  sourceService: { id: string; name: string; icon: string };
  targetService: { id: string; name: string; icon: string };
  sourceAmount: number;
  targetAmount: number;
  status: 'SUCCESS' | 'FAILED' | 'PROCESSING';
}

interface ExchangeHistoryListProps {
  records: ExchangeRecord[];
}

const STATUS_CONFIG = {
  SUCCESS: { label: '✅ 완료', color: 'bg-green-100 text-green-700' },
  FAILED: { label: '❌ 실패', color: 'bg-red-100 text-red-700' },
  PROCESSING: { label: '⏳ 처리중', color: 'bg-blue-100 text-blue-700' },
};

export default function ExchangeHistoryList({ records }: ExchangeHistoryListProps) {
  if (records.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <p className="text-gray-500">교환 내역이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record) => (
        <div
          key={record.id}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
        >
          {/* Timestamp */}
          <p className="text-xs text-gray-500 mb-3">
            {new Date(record.createdAt).toLocaleString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>

          {/* Service Direction */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">{record.sourceService.icon}</span>
              <span className="text-sm font-medium text-gray-900">
                {record.sourceService.name}
              </span>
            </div>
            <span className="text-gray-400">→</span>
            <div className="flex items-center gap-2">
              <span className="text-xl">{record.targetService.icon}</span>
              <span className="text-sm font-medium text-gray-900">
                {record.targetService.name}
              </span>
            </div>
          </div>

          {/* Amount */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-gray-900">
                {record.sourceAmount.toLocaleString()}P
              </span>
              <span className="text-gray-400">→</span>
              <span className="text-lg font-bold text-green-600">
                {record.targetAmount.toLocaleString()}P
              </span>
            </div>

            {/* Status Badge */}
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                STATUS_CONFIG[record.status].color
              }`}
            >
              {STATUS_CONFIG[record.status].label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 3.3 페이지네이션 컴포넌트 (Pagination)

```tsx
// components/common/Pagination.tsx
import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  // 모바일: 현재 페이지 ±2만 표시
  const visiblePages = pages.filter(
    (page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2
  );

  return (
    <div className="flex items-center justify-center gap-2">
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        ←
      </button>

      {/* Page Numbers */}
      {visiblePages.map((page, index) => {
        const showEllipsis = index > 0 && page - visiblePages[index - 1] > 1;
        return (
          <React.Fragment key={page}>
            {showEllipsis && (
              <span className="px-2 text-gray-400">...</span>
            )}
            <button
              onClick={() => onPageChange(page)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                page === currentPage
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {page}
            </button>
          </React.Fragment>
        );
      })}

      {/* Next Button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        →
      </button>
    </div>
  );
}
```

---

## 🎨 4. 반응형 디자인 가이드

### 4.1 브레이크포인트

```css
/* TailwindCSS 기본 브레이크포인트 사용 */
sm: 640px   /* 모바일 가로 */
md: 768px   /* 태블릿 */
lg: 1024px  /* 데스크탑 */
xl: 1280px  /* 와이드 데스크탑 */
```

### 4.2 모바일 최적화 원칙

1. **터치 타겟 크기**: 최소 44x44px (버튼, 링크)
2. **여백**: 모바일에서 `px-4` (16px), 데스크탑 `px-6` (24px)
3. **폰트 크기**: 본문 최소 14px, 제목 20px 이상
4. **입력 필드**: 높이 48px 이상 (손가락 터치 용이)
5. **모달**: 전체 화면에 가깝게 (모바일), 중앙 카드형 (데스크탑)

---

## 🎨 5. 에러 상태 디자인

### 5.1 토스트 메시지 (전역 컴포넌트)

```tsx
// components/common/Toast.tsx
import React, { useEffect } from 'react';

interface ToastProps {
  type: 'success' | 'error' | 'warning';
  message: string;
  duration?: number;
  onClose: () => void;
}

const TOAST_CONFIG = {
  success: { icon: '✅', color: 'bg-green-500' },
  error: { icon: '❌', color: 'bg-red-500' },
  warning: { icon: '⚠️', color: 'bg-yellow-500' },
};

export default function Toast({ type, message, duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const config = TOAST_CONFIG[type];

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
      <div className={`${config.color} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px]`}>
        <span className="text-xl">{config.icon}</span>
        <p className="font-medium">{message}</p>
      </div>
    </div>
  );
}

// tailwind.config.js에 추가
// animation: {
//   'slide-down': 'slideDown 0.3s ease-out',
// },
// keyframes: {
//   slideDown: {
//     '0%': { transform: 'translateY(-100%) translateX(-50%)', opacity: 0 },
//     '100%': { transform: 'translateY(0) translateX(-50%)', opacity: 1 },
//   },
// },
```

### 5.2 입력 필드 에러 상태

```tsx
// 에러 상태 예시
<input
  type="number"
  className={`w-full px-4 py-3 border-2 rounded-lg ${
    error
      ? 'border-red-500 focus:border-red-600 bg-red-50'
      : 'border-gray-300 focus:border-blue-500'
  }`}
/>
{error && (
  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
    <span>⚠️</span>
    {error}
  </p>
)}
```

---

## 📋 6. 타입 정의 (TypeScript)

```typescript
// types/account-linking.ts
export interface ServiceLinkStatus {
  id: string;
  name: string;
  icon: string;
  isLinked: boolean;
  linkedAt?: string;
}

export interface LinkTokenResponse {
  verification_token: string;
  expires_at: string;
}

export interface VerifyTokenRequest {
  verification_token: string;
  target_service_id: string;
  target_auth_user_id: string;
}

export interface VerifyTokenResponse {
  unified_user_id: string;
  verified_at: string;
}

// types/point-exchange.ts
export interface LinkedService {
  id: string;
  name: string;
  icon: string;
  isLinked: boolean;
  balance?: number;
}

export interface ExchangeRequest {
  idempotency_key: string;
  unified_user_id: string;
  source_service_id: string;
  source_point_code: string;
  source_auth_user_id: string;
  source_amount: number;
  target_service_id: string;
  target_point_code: string;
  target_auth_user_id: string;
}

export interface ExchangeResponse {
  id: string;
  status: 'SUCCESS' | 'FAILED' | 'PROCESSING';
  source_amount: number;
  target_amount: number;
  exchange_rate: number;
  completed_at?: string;
  error?: string;
}

export interface ExchangeRecord {
  id: string;
  createdAt: string;
  sourceService: { id: string; name: string; icon: string };
  targetService: { id: string; name: string; icon: string };
  sourceAmount: number;
  targetAmount: number;
  status: 'SUCCESS' | 'FAILED' | 'PROCESSING';
}

export interface ExchangeHistoryResponse {
  total: number;
  page: number;
  limit: number;
  items: ExchangeRecord[];
}
```

---

## 🚀 7. 구현 우선순위

### Phase 1 (이번 주)
- [x] 계정 연동 페이지 (ServiceCard + TokenDisplayModal + TokenInputModal)
- [x] 포인트 교환 페이지 (ExchangeForm + ConfirmModal)

### Phase 2 (다음 주)
- [ ] 교환 내역 페이지 (ExchangeHistoryList + Pagination)
- [ ] globalLoader 통합
- [ ] Toast 컴포넌트 통합

### Phase 3 (QA)
- [ ] 모바일 반응형 테스트
- [ ] 에러 케이스 시나리오 테스트
- [ ] 접근성 검증 (키보드 네비게이션, 스크린리더)

---

## 📝 8. 디자인 노트

### 8.1 색상 일관성
- 연동됨: `green-50/200/700` (신뢰감)
- 미연동: `gray-50/200/600` (중립)
- CTA 버튼: `blue-600/700` (행동 유도)
- 경고: `yellow-50/200/700` (주의)
- 에러: `red-50/500/600` (위험)

### 8.2 타이포그래피
- 제목 (h1): `text-2xl font-bold`
- 부제목 (h2): `text-xl font-bold`
- 본문: `text-sm text-gray-600`
- 버튼: `text-sm font-medium` (모바일), `text-base font-medium` (데스크탑)
- 포인트 금액: `font-mono` (숫자 정렬)

### 8.3 아이콘 가이드
- 서비스별 이모지 통일:
  - 게임랜드: 🎮
  - 플레이랜드: 🎯
  - 오피스랜드: 🏢
- 상태 표시:
  - 성공: ✅
  - 실패: ❌
  - 처리중: ⏳
  - 경고: ⚠️

---

## 📦 9. 전달 사항

### 9.1 bon/Reus에게
1. 위 컴포넌트 코드를 각 랜드 서비스 프로젝트에 복사 후 통합
2. API 엔드포인트를 실제 백엔드 URL로 교체
3. globalLoader는 기존 구현을 활용 (토스트는 위 컴포넌트 참고)
4. `SERVICES`, `LINKED_SERVICES` 등의 더미 데이터를 실제 API 응답으로 교체

### 9.2 kyago/WorkClaw에게
1. 각 서비스에서 `unified_user_id`, `auth_user_id` 획득 방법 확인 필요
2. 포인트 잔액 조회 API 엔드포인트 공유 필요
3. 에러 코드 표준화 (USER_NOT_LINKED, INVALID_AMOUNT 등)

### 9.3 PlanClaw에게
1. 오피스랜드 포인트 기능 구현 일정 확인
2. 환율 변경 로직 추가 시점 기획 필요
3. 교환 내역 필터 기능 (날짜, 서비스 등) 추후 기획

---

_DesignClaw — 2026-03-01_
