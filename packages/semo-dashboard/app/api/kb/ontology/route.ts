import { NextResponse } from 'next/server';
import { listOntology } from '@/lib/kb';

export async function GET() {
  try {
    const domains = await listOntology();
    return NextResponse.json(domains);
  } catch (error) {
    console.error('Error listing ontology:', error);
    return NextResponse.json(
      { error: 'Failed to list ontology' },
      { status: 500 }
    );
  }
}
