import { ScreenMobileHome, ScreenMobileTeam, ScreenMobileLibrary } from '../../_ui/screen-mobile';

/** 공개 데모 — 모바일 프리뷰 (홈/직원/채용, mock). */
export default function DemoMobilePreviewPage() {
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
