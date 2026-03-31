import { redirect } from 'next/navigation';

export default function OntologyPage() {
  redirect('/kb?tab=ontology');
}
