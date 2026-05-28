import { ScreenLibraryList } from '../../_ui/screen-library';
import { getLibraryListings } from '@/lib/customer/data';

export const dynamic = 'force-dynamic';

/** 공개 데모 — 직원 카탈로그(전역, /my 와 동일). */
export default async function DemoLibraryPage() {
  const listings = await getLibraryListings();
  return <ScreenLibraryList listings={listings} />;
}
