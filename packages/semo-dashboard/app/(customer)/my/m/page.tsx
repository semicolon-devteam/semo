import { ScreenMobileHome, ScreenMobileTeam, ScreenMobileLibrary } from '../../_ui/screen-mobile';

/**
 * 모바일 화면 프리뷰 (홈/직원/채용). 각 컴포넌트가 자체 PhoneFrame 포함.
 * 실제 모바일 배포는 PWA→Capacitor 패키징 트랙(2026-05-27-semo-dashboard-app-packaging.md).
 */
export default function MyMobilePreviewPage() {
  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        background: 'var(--semo-bg-soft)',
        display: 'flex',
        gap: 40,
        padding: 48,
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      <ScreenMobileHome />
      <ScreenMobileTeam />
      <ScreenMobileLibrary />
    </div>
  );
}
