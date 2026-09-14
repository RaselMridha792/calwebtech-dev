import type { Metadata } from 'next';
import { LegalRoute, legalPageMetadata } from '@/components/static/legal-route';

export function generateMetadata(): Promise<Metadata> {
  return legalPageMetadata('terms');
}

export default function TermsPage() {
  return <LegalRoute slug="terms" />;
}
