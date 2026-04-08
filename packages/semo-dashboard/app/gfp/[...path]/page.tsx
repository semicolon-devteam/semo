import { redirect } from 'next/navigation';

// Legacy redirect: /gfp/* → /projects/*
export default async function LegacyGfpRedirect({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  redirect(`/projects/${path.join('/')}`);
}
