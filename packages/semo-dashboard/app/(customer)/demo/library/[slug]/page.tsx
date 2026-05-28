import { ScreenLibraryDetail } from '../../../_ui/screen-library';
import { getListingBySlug } from '@/lib/customer/data';

/** 공개 데모 — 직원 상세(전역 카탈로그, /my 와 동일). */
export default async function DemoLibraryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = await getListingBySlug(slug);
  return <ScreenLibraryDetail slug={slug} agent={agent} />;
}
