import { ScreenProvider } from '../../_ui/screen-provider';

/** Provider · Agent Factory & Curation (§4.5). 내부 탭(My Agents/검수/게시예정/아카이브) 작동. */
export default function MyProviderPage() {
  return <ScreenProvider tab="review" />;
}
