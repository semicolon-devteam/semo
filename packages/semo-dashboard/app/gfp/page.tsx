import { redirect } from 'next/navigation';

// Legacy redirect: /gfp → /projects
export default function GfpRootRedirect() {
  redirect('/projects');
}
