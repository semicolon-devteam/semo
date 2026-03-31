import { redirect } from 'next/navigation';

export default function SyncPage() {
  redirect('/system?tab=sync');
}
