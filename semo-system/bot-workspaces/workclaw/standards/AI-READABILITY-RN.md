# AI Readability 코드 표준 (React Native)

> React Native 프로젝트 특화 규칙

**[← Core 규칙 보기](./AI-READABILITY.md)**

---

## 1. Import 순서

ESLint `import/order`로 자동 강제:

```typescript
// 1. React
import React, { useCallback, useState } from 'react';

// 2. React Native
import { View, Text, StyleSheet, Platform } from 'react-native';

// 3. 외부 라이브러리
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';

// 4. 내부 절대경로 (@/)
import { COLORS, FONT_SIZE } from '@/constants/theme';
import { apiService } from '@/services/api.service';

// 5. 타입 import
import type { User } from '@/types';

// 6. 상대경로
import { styles } from './Screen.styles';
```

---

## 2. 스타일 관리 규칙

### 2-1. 색상 리터럴 금지

모든 색상은 `@/constants/theme.ts`의 `COLORS` 토큰 사용:

```typescript
// Bad
backgroundColor: '#1A1A2E',
color: '#FFD700',

// Good
backgroundColor: COLORS.background,
color: COLORS.tierGold,
```

**예외 허용** (명시적 주석):
```typescript
// RN 시스템 요구사항
shadowColor: '#000', // eslint-disable-line react-native/no-color-literals
```

### 2-2. StyleSheet 분리

스크린 컴포넌트의 `StyleSheet.create()`가 **150줄 초과** 시 별도 파일 분리:

```typescript
// FooScreen.styles.ts
import { StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    fontSize: FONT_SIZE.large,
    color: COLORS.text,
  },
});
```

```typescript
// FooScreen.tsx
import { styles } from './FooScreen.styles';
// 또는
import { styles } from '../styles/FooScreen.styles';
```

### 2-3. 인라인 스타일 지양

```typescript
// Bad
<View style={{ flex: 1, backgroundColor: '#000', padding: 16 }}>

// Good
<View style={styles.container}>
```

**예외**: 동적 스타일은 허용 (단, 색상 토큰 사용)
```typescript
// Good - 동적 값
<View style={[styles.box, { width: dynamicWidth }]}>
```

---

## 3. 스크린 컴포넌트 구조

### 3-1. 표준 구조

```typescript
/**
 * @module VideoCallScreen
 * @description WebRTC 1:1 비디오 통화 스크린
 * @dependencies WebRTCProvider, SocketService
 * @business-rules
 *  - 통화 중 뒤로가기 방지
 *  - 음소거 상태는 로컬 스토리지에 저장
 * @navigation
 *  - 진입: HomeScreen → VideoCallScreen
 *  - 이탈: 통화 종료 시 HomeScreen으로 복귀
 */

// ═══════════════════════════════════════
// Imports
// ═══════════════════════════════════════
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

// ═══════════════════════════════════════
// Types & Interfaces
// ═══════════════════════════════════════
interface VideoCallScreenProps {
  route: { params: { userId: string } };
}

// ═══════════════════════════════════════
// Constants
// ═══════════════════════════════════════
const CALL_TIMEOUT_MS = 30000;

// ═══════════════════════════════════════
// Main Component
// ═══════════════════════════════════════
const VideoCallScreen: React.FC<VideoCallScreenProps> = ({ route }) => {
  // Hooks 순서: useState → useRef → useCallback → useMemo → useEffect
  const [isMuted, setIsMuted] = useState(false);
  const navigation = useNavigation();

  const handleMute = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted]);

  useEffect(() => {
    // 통화 초기화
  }, []);

  // Early returns
  if (!route.params.userId) {
    navigation.goBack();
    return null;
  }

  // JSX
  return (
    <View style={styles.container}>
      {/* ... */}
    </View>
  );
};

export default VideoCallScreen;

// ═══════════════════════════════════════
// Styles
// ═══════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
```

### 3-2. Hooks 순서 (강제)

```typescript
// 1. React Hooks
const [state, setState] = useState(initialValue);
const ref = useRef<View>(null);

// 2. Navigation Hooks
const navigation = useNavigation();
const route = useRoute();

// 3. useCallback
const handlePress = useCallback(() => { ... }, []);

// 4. useMemo
const computed = useMemo(() => { ... }, [deps]);

// 5. useEffect
useEffect(() => { ... }, [deps]);

// 6. 커스텀 훅
const { data } = useCallData(callId);
```

---

## 4. 파일 분리 패턴

### 4-1. Feature 기반 구조

```
features/call/
├── screens/
│   └── VideoCallScreen.tsx     # 메인 스크린 (≤600줄)
├── components/
│   ├── CallControlsPanel.tsx   # 음소거/카메라 버튼
│   └── GiftSendingModal.tsx    # 선물 전송 모달
├── hooks/
│   └── useVideoCallLogic.ts    # WebRTC + 소켓 이벤트
├── styles/
│   └── VideoCallScreen.styles.ts # 스타일 (150줄+)
└── types/
    └── call.types.ts           # 타입 정의
```

---

## 5. Platform-Specific 코드

### 5-1. Platform.select 사용

```typescript
import { Platform } from 'react-native';

const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
      },
      android: {
        elevation: 3,
      },
    }),
  },
});
```

### 5-2. Platform.OS 조건문

```typescript
// @relates-to measureInWindow API
// @platform-specific Android 버그 방어
if (y === 0 && Platform.OS === 'android') {
  // Android에서 measureInWindow가 0을 반환하는 경우 방어 처리
  return;
}
```

---

## 6. Navigation 타입 정의

```typescript
// types/navigation.types.ts
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export interface RootStackParamList {
  Home: undefined;
  VideoCall: { userId: string };
  Profile: { userId: string };
}

export type VideoCallScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'VideoCall'
>;
```

```typescript
// screens/VideoCallScreen.tsx
import type { VideoCallScreenNavigationProp } from '@/types/navigation.types';

const VideoCallScreen = () => {
  const navigation = useNavigation<VideoCallScreenNavigationProp>();
  
  const handleClose = () => {
    navigation.navigate('Home');
  };
  
  // ...
};
```

---

## 7. 커스텀 훅 분리 (RN 특화)

### 7-1. 데이터 페칭 + 상태 관리

```typescript
// hooks/useVideoCallLogic.ts
/**
 * @module useVideoCallLogic
 * @description WebRTC 통화 로직 + 소켓 이벤트 핸들러
 * @dependencies WebRTCProvider, SocketService
 * @state-management
 *  - isMuted, isCameraOn, isConnected
 * @side-effects
 *  - 소켓 연결/해제
 *  - WebRTC peer 생성/종료
 */
export const useVideoCallLogic = (callId: string) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
    // WebRTC 음소거 처리
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    setIsCameraOn(!isCameraOn);
    // WebRTC 카메라 토글
  }, [isCameraOn]);

  useEffect(() => {
    // 소켓 연결
    return () => {
      // 정리
    };
  }, [callId]);

  return {
    isMuted,
    isCameraOn,
    isConnected,
    toggleMute,
    toggleCamera,
  };
};
```

---

## 8. ESLint 설정 (RN 특화)

```json
{
  "extends": [
    "@react-native-community",
    "plugin:react-native/all"
  ],
  "rules": {
    // 색상/스타일
    "react-native/no-color-literals": "error",
    "react-native/no-unused-styles": "error",
    "react-native/no-inline-styles": "warn",
    "react-native/split-platform-components": "warn",
    
    // Import 순서
    "import/order": ["error", {
      "groups": ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
      "pathGroups": [
        { "pattern": "react", "group": "external", "position": "before" },
        { "pattern": "react-native", "group": "external", "position": "before" },
        { "pattern": "@react-navigation/**", "group": "external", "position": "before" },
        { "pattern": "@/**", "group": "internal" }
      ],
      "pathGroupsExcludedImportTypes": ["react", "react-native"],
      "alphabetize": { "order": "asc" }
    }]
  }
}
```

---

## 9. 성능 최적화 패턴

### 9-1. FlatList 최적화

```typescript
<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
  // 성능 최적화
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
  initialNumToRender={10}
  windowSize={5}
  // 메모이제이션된 props
  getItemLayout={getItemLayout}
/>
```

### 9-2. React.memo 사용

```typescript
// @performance-critical 리렌더링 빈번
export const CallControlButton = React.memo<CallControlButtonProps>(
  ({ icon, onPress, isActive }) => (
    <TouchableOpacity onPress={onPress} style={styles.button}>
      <Icon name={icon} color={isActive ? COLORS.primary : COLORS.gray} />
    </TouchableOpacity>
  )
);
```

---

## 10. Context Headers (RN 특화)

```typescript
/**
 * @module ClubDashboardScreen
 * @description 클럽 대시보드 (멤버 관리, 뮤즈 수익률 설정)
 * @dependencies ClubService, MemberService
 * @navigation
 *  - 진입: ClubListScreen → ClubDashboardScreen
 *  - 이탈: 뒤로가기 → ClubListScreen
 * @business-rules
 *  - 매니저만 멤버 승인/거절 가능
 *  - 뮤즈 수익률은 0-100% 범위
 * @performance
 *  - 멤버 목록: FlatList 가상화
 *  - 이미지: FastImage 사용
 * @platform-specific
 *  - iOS: Shadow 사용
 *  - Android: Elevation 사용
 */
```

---

## 11. 체크리스트 (RN 추가)

Core 체크리스트에 추가:

- [ ] 색상 리터럴 (`'#XXXXXX'`)을 직접 쓰지 않았는가?
- [ ] StyleSheet가 150줄 이하인가? (초과 시 분리)
- [ ] 인라인 스타일을 사용하지 않았는가?
- [ ] Platform-specific 코드에 주석이 있는가?
- [ ] FlatList 성능 최적화가 적용되었는가?
- [ ] Navigation 타입이 명시되었는가?

---

## 참고 자료

- [React Native 공식 문서](https://reactnative.dev/)
- [React Navigation 공식 문서](https://reactnavigation.org/)
- [React Native Performance Guide](https://reactnative.dev/docs/performance)
