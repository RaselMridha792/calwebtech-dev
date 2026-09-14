import type { Metadata } from 'next';
import { LegalRoute, legalPageMetadata } from '@/components/static/legal-route';

export function generateMetadata(): Promise<Metadata> {
  return legalPageMetadata('accessibility');
}

export default function AccessibilityStatementPage() {
  return <LegalRoute slug="accessibility" />;
}
