import { ScreenLibraryList } from '../../_ui/screen-library';
import { getLibraryListings } from '@/lib/customer/data';

// 실 카탈로그를 매 요청 반영 (정적 프리렌더 시 빌드타임 빈 DB→mock 으로 고정되는 것 방지).
export const dynamic = 'force-dynamic';

/** 서버에서 승인된 카탈로그를 페치해 ScreenLibraryList 에 주입. 비면 화면이 mock 폴백. */
export default async function MyLibraryPage() {
  const listings = await getLibraryListings();
  return <ScreenLibraryList listings={listings} />;
}
