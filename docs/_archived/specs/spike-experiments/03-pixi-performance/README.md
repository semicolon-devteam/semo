# SPIKE-06-01: PixiJS 렌더링 성능 테스트

> Agent 30개 + 애니메이션 60fps 유지 가능 여부 검증

---

## 실험 목적

PixiJS는 Semo Office UI의 핵심 렌더링 엔진입니다.
이 Spike는 다음을 검증합니다:

1. **렌더링 성능**: Agent 30개 + 애니메이션 60fps 유지
2. **메모리 효율**: 장시간 실행 시 메모리 누수
3. **모바일 대응**: 모바일 브라우저에서 30fps 유지
4. **인터랙션**: 줌/팬 시 성능 저하 없음

---

## 성공 기준

| 지표 | 목표 | Critical |
|------|------|----------|
| 데스크톱 FPS | > 60fps | ✅ 필수 |
| 모바일 FPS | > 30fps | ⚠️ 중요 |
| 초기 로딩 | < 3초 | ⚠️ 중요 |
| 메모리 사용량 | < 500MB | ✅ 필수 |

---

## 실험 환경

### 요구 사항

- Node.js 18+
- 모던 브라우저 (Chrome, Safari, Firefox)
- 모바일 디바이스 (선택적)

### 설치

```bash
cd specs/spike-experiments/03-pixi-performance
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

---

## 실험 시나리오

### Test 1: 기본 렌더링 성능

**목적**: Agent 30개 기본 렌더링 FPS 측정

**절차**:
1. 브라우저에서 테스트 페이지 오픈
2. "Test 1: Basic Rendering" 클릭
3. Agent 30개 생성
4. FPS 모니터 확인 (30초간)

**측정 항목**:
- 평균 FPS
- 최소 FPS
- 메모리 사용량

**예상 결과**:
```
Agent 수: 30
평균 FPS: 62
최소 FPS: 58
메모리: 215 MB
✅ 성공
```

### Test 2: 애니메이션 부하 테스트

**목적**: 모든 Agent가 애니메이션 실행 시 FPS

**절차**:
1. Agent 30개 생성
2. 각 Agent에 애니메이션 추가:
   - 25개: idle (2fps)
   - 5개: working (4fps)
3. FPS 측정 (1분간)

**예상 결과**:
```
애니메이션 Agent: 30
평균 FPS: 60
최소 FPS: 54
✅ 성공
```

### Test 3: 줌/팬 인터랙션

**목적**: 줌/팬 시 성능 저하 측정

**절차**:
1. Agent 30개 렌더링
2. 마우스 휠로 줌 인/아웃 (0.5x ~ 2x)
3. 드래그로 팬 이동
4. FPS 변화 관찰

**예상 결과**:
```
줌 0.5x: 60 FPS
줌 1.0x: 60 FPS
줌 2.0x: 58 FPS
팬 중: 60 FPS
✅ 성공
```

### Test 4: 모바일 성능

**목적**: 모바일 브라우저 FPS 측정

**절차**:
1. 모바일 디바이스에서 접속
2. Agent 30개 렌더링
3. FPS 측정

**예상 결과**:
```
디바이스: iPhone 13
평균 FPS: 35
최소 FPS: 28
✅ 성공 (> 30fps)
```

### Test 5: 장시간 안정성

**목적**: 10분간 실행 시 메모리 누수 확인

**절차**:
1. Agent 30개 + 애니메이션
2. 10분간 실행
3. 메모리 사용량 추이 관찰

**예상 결과**:
```
0분: 220 MB
5분: 245 MB
10분: 260 MB
증가율: 4 MB/분
✅ 성공 (< 50 MB/10분)
```

---

## 구현 예시

### PixiJS Stage 설정

```typescript
import * as PIXI from 'pixi.js';

const app = new PIXI.Application({
  width: 1280,
  height: 960,
  backgroundColor: 0xf0f0f0,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});

document.body.appendChild(app.view);

// FPS 카운터
const fpsText = new PIXI.Text('FPS: 0', {
  fontSize: 24,
  fill: 0x000000,
});
app.stage.addChild(fpsText);

// FPS 측정
let lastTime = performance.now();
let frames = 0;
app.ticker.add(() => {
  frames++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    const fps = Math.round(frames * 1000 / (now - lastTime));
    fpsText.text = `FPS: ${fps}`;
    frames = 0;
    lastTime = now;
  }
});
```

### Agent 스프라이트

```typescript
class AgentSprite extends PIXI.Container {
  private sprite: PIXI.Sprite;
  private animation: PIXI.AnimatedSprite;

  constructor(role: string) {
    super();

    // 아바타 로드
    const texture = PIXI.Texture.from(`/sprites/${role}.png`);
    this.sprite = new PIXI.Sprite(texture);
    this.sprite.anchor.set(0.5);
    this.addChild(this.sprite);

    // Idle 애니메이션 (2프레임)
    this.animation = new PIXI.AnimatedSprite([
      PIXI.Texture.from(`/sprites/${role}-idle-1.png`),
      PIXI.Texture.from(`/sprites/${role}-idle-2.png`),
    ]);
    this.animation.animationSpeed = 2/60; // 2fps
    this.animation.play();
  }

  setState(state: 'idle' | 'working' | 'blocked') {
    // 상태별 애니메이션 전환
  }
}
```

---

## 성능 최적화 기법

### 1. Sprite Batching

```typescript
// 같은 텍스처를 사용하는 스프라이트는 자동으로 배칭됨
// 역할별로 텍스처 공유
const agentTextures = {
  FE: PIXI.Texture.from('/sprites/fe.png'),
  BE: PIXI.Texture.from('/sprites/be.png'),
  // ...
};
```

### 2. Object Pooling

```typescript
class AgentPool {
  private pool: AgentSprite[] = [];

  acquire(role: string): AgentSprite {
    if (this.pool.length > 0) {
      const sprite = this.pool.pop()!;
      sprite.visible = true;
      return sprite;
    }
    return new AgentSprite(role);
  }

  release(sprite: AgentSprite) {
    sprite.visible = false;
    this.pool.push(sprite);
  }
}
```

### 3. Culling (화면 밖 렌더링 생략)

```typescript
app.ticker.add(() => {
  agents.forEach(agent => {
    const bounds = agent.getBounds();
    const visible = viewport.intersects(bounds);
    agent.renderable = visible;
  });
});
```

---

## 대안 (NO-GO 시)

### 대안 1: React Flow

**장점**:
- SVG 기반, 구현 간단
- React 생태계 활용

**단점**:
- 성능 낮음 (Agent 20개 제한)

**구현 시간**: +1주

### 대안 2: LOD (Level of Detail)

**구현**:
```typescript
// 줌 레벨에 따라 렌더링 품질 조절
if (zoom < 0.5) {
  // 간단한 도형으로 표시
  agent.useSimpleGraphics();
} else {
  // 상세 스프라이트 표시
  agent.useDetailedSprite();
}
```

**효과**: FPS 10~20% 향상

### 대안 3: Agent 수 제한

**구현**: Office당 최대 Agent 12개

**트레이드오프**: 기능 제약

---

## 실행 방법

```bash
# 개발 서버 시작
npm run dev

# 브라우저에서 테스트
open http://localhost:3000

# 자동 테스트 (Playwright)
npm run test:e2e

# 성능 프로파일링
npm run profile
```

---

## 리포트 생성

테스트 완료 후 자동 리포트 생성:

```bash
npm run report
```

생성 파일:
- `results/performance-report.md`
- `results/fps-chart.png`
- `results/memory-chart.png`

---

## Next Steps

1. ✅ PixiJS 프로젝트 설정
2. ⏳ Agent 스프라이트 이미지 준비 (8개 역할)
3. ⏳ 테스트 1~5 실행
4. ⏳ 결과 분석
5. ⏳ Go/No-Go 결정
