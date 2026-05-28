# SEMO Dashboard 앱 패키징 전략 (모바일 + 데스크탑)

> 2026-05-27 · 작성: reus 요청 · 대상: SEMO Dashboard (Next.js 15 App Router + React 19 + Tailwind, Vercel + PWA manifest)

---

## 1. 옵션 평가 (각 1문단 + 점수)

평가 점수: 5점 만점. 평가 축 = 코드재사용 / 푸시 / 백그라운드 / 딥링크·OAuth / CI·CD / 스토어 통과 / 번들 / 유지보수 / OS 기능 접근.

**1. PWA only (현 manifest 확장)** — 코드 100% 재사용 (SSR 그대로 유지 가능, Vercel 그대로). iOS 16.4+는 홈스크린 설치 시에만 Web Push 가능하고, silent push·background fetch는 여전히 불가. 데스크탑은 Chrome/Edge install로 시스템 알림 + taskbar pin 가능 (Edge는 startup boost로 백그라운드 유지, Chrome은 창 하나 열려 있어야 푸시 수신). 스토어 심사 자체가 없음. **점수: 3.5 / 5** — "Phase 0"으로 즉시 시작 가능하지만 iOS reach가 10–15배 줄어들고 "에이전트 핸들링"에 필요한 백그라운드 작업·마이크 항시 대기 같은 OS 통합은 사실상 불가.

**2. Capacitor (Ionic)** — Web을 WebView로 wrap. Next.js 15 App Router는 **`output: 'export'` 정적 빌드를 강제**해야 하므로 Server Components / Server Actions / dynamic route 사용 부분은 분기 또는 리팩토링 필요 (또는 원격 SSR을 WebView로 로드하는 hybrid도 가능하나 4.2 거절 위험 증가). 푸시는 `@capacitor-firebase/messaging`으로 FCM+APNs 통합 성숙. 딥링크·OAuth·마이크·백그라운드 작업은 풍부한 플러그인 생태계로 해결. 빌드 파이프라인은 Xcode/Android Studio 서명만 추가. **점수: 4.2 / 5** — 모바일 양 OS 통합 1순위.

**3. Tauri 2.0** — 데스크탑 stable, **모바일 iOS/Android는 stable API라고 표기는 됐지만 "1st-class citizen" 단계 전 foundation 단계**라고 Tauri 팀 본인이 명시. 푸시는 코어가 아니라 커뮤니티 플러그인(`tauri-plugin-mobile-push`, `tauri-plugin-fcm`, `Choochmeque/tauri-plugin-notifications`)에 의존하며 메인테이너 1–2명 규모. 데스크탑은 OS WebView 사용으로 2–10MB 번들 / 30–50MB RAM로 Electron 대비 압도적. WebView가 Windows는 WebView2, macOS는 WKWebView로 갈리는 렌더링 차이가 실제 이슈. **점수: 데스크탑 4.5 / 모바일 2.8** — 데스크탑 1순위, 모바일은 8명 코어팀에 권장 X.

**4. Electron** — 데스크탑 전용. JS 풀스택, auto-updater (`electron-updater`)·코드사이닝·앱스토어 배포 경로가 가장 성숙. 트레이드오프: 번들 80–200MB, idle RAM 200–300MB, Chromium 보안 패치 따라가야 함. Next.js 빌드를 그대로 `loadURL`로 띄울 수도 있고 정적 export로 `loadFile`도 가능. **점수: 3.8 / 5** — 안전한 대안이지만 Tauri 대비 무거워 SEMO 같은 "상시 띄워두는 보조 도구"에는 불리.

**5. React Native (new architecture)** — Next.js 코드 재사용 불가, 사실상 별도 앱 빌드. 8명 팀이 dashboard + RN 양쪽 유지 비용 부담 큼. **점수: 2.0 / 5** — 본 케이스에서는 비추천.

## 2. 추천 조합

**iOS·Android = Capacitor, 데스크탑 = Tauri 2, 웹 baseline = PWA 강화.**

이유: (a) 코어 UI 100%를 단일 Next.js 코드베이스에 두되 — 모바일 빌드는 정적 export, 데스크탑·웹은 SSR 유지 — 빌드 매트릭스 2개로 한정. (b) 푸시는 iOS/Android에서 FCM 단일 백엔드로 통합 가능(`@capacitor-firebase/messaging` + Tauri는 데스크탑 OS 네이티브 알림으로 충분, 모바일 푸시는 Capacitor가 담당). (c) Tauri 모바일 베타 리스크를 회피 — 데스크탑만 Tauri로 가져가면 8명 팀이 Rust 학습 곡선을 데스크탑 빌드에만 한정 적용. (d) Capacitor가 마이크·백그라운드 fetch·딥링크·OAuth 콜백을 모두 1군 플러그인으로 제공.

## 3. 로드맵

- **Phase 0 (현재 ~ 2주)**: PWA 강화. manifest icon/screenshot 보강, declarative web push (Safari 18.4+) 적용, Service Worker로 offline shell + 알림 액션 (Approve/Reject) 라우팅, Web Share Target 등록. 위험 없음, 즉시 reus 본인 iPhone에서 홈스크린 설치 후 dogfooding.
- **Phase 1 (3 ~ 6주)**: Capacitor 7+ 도입. Next.js를 hybrid 분기 — 정적 라우트 export 빌드를 `apps/mobile-shell/`로 분리, API/SSR 라우트는 Vercel 유지하고 모바일은 `https://semo.semi-colon.space` REST 호출. FCM 프로젝트 생성, APNs `.p8` 등록, deep link `semo://` scheme + Universal Link 양쪽. TestFlight + Play Internal Testing.
- **Phase 2 (7 ~ 12주)**: Tauri 2 데스크탑. 시스템 트레이 상주 + 글로벌 단축키로 빠른 명령 입력. macOS 코드사이닝 + notarization, Windows code signing (EV 인증서 또는 Azure Trusted Signing). Sparkle/`tauri-plugin-updater` 자동 업데이트.

## 4. 주의할 함정 3개

1. **App Store 4.2 거절** — Capacitor WebView가 그냥 SSR 페이지를 로드만 하는 형태이면 거절 확정. **반드시 네이티브 탭바, 푸시 알림 액션, 오프라인 모드, 마이크 quick-capture 같은 "앱다운" 기능 최소 3개를 첫 제출 전에 구현**. Median.co/MobiLoud 사례가 명확.
2. **Next.js 15 Server Components / Server Actions의 정적 export 비호환** — 모바일 shell 분기 시 동적 라우트, `searchParams`, `cookies()`, Server Actions를 사용하는 페이지는 별도 client-side fetch로 리팩토링 필요. 단순 `output: 'export'` 토글로 끝나지 않음. PoC를 Phase 1 첫 주에 빌드 깨지는 페이지 인벤토리부터 작성.
3. **iOS 푸시 도달률 함정** — Capacitor 도입해도 사용자가 알림 권한을 거부하면 PWA 시절과 동일하게 무용지물. 첫 실행 시 권한 요청을 무조건 띄우지 말고 "에이전트 작업 시작" 등 가치 명확한 시점에 contextual prompt로 요청. APNs `.p8` 키 만료(없음, 영구) vs 인증서(1년) 혼동 주의 — 반드시 `.p8` 사용.

---

**참고**:

- Tauri 2.0 stable 공지 (2024-10-08): <https://v2.tauri.app/blog/tauri-20/>
- Tauri 모바일 푸시 플러그인: <https://github.com/yanqianglu/tauri-plugin-mobile-push>, <https://github.com/Choochmeque/tauri-plugin-notifications>
- Capacitor + Next.js 15 가이드: <https://capgo.app/blog/building-a-native-mobile-app-with-nextjs-and-capacitor/>
- `@capacitor-firebase/messaging`: <https://www.npmjs.com/package/@capacitor-firebase/messaging>
- Apple 4.2 Minimum Functionality: <https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper>
- PWA iOS 푸시 한계 (2026): <https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide>
- Tauri vs Electron 2026 벤치마크: <https://www.pkgpulse.com/guides/electron-vs-tauri-2026>
- Edge PWA 백그라운드 알림: <https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/ux>
