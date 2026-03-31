import { redirect } from 'next/navigation';

export default function DBExplorerPage() {
  redirect('/system?tab=db');
}
