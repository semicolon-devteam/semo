import { ScreenLibraryDetail } from '../../../_ui/screen-library';
import { getListingBySlug } from '@/lib/customer/data';

/** 직원 상세 + 채용 마법사 3스텝. slug = 에이전트 id (예: jumuni, hwegyedo-ri). */
export default async function MyLibraryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = await getListingBySlug(slug);
  return <ScreenLibraryDetail slug={slug} agent={agent} />;
}
