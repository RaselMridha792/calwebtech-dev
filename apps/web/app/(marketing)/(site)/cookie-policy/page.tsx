import type { Metadata } from 'next';
import { LegalRoute, legalPageMetadata } from '@/components/static/legal-route';

export function generateMetadata(): Promise<Metadata> {
  return legalPageMetadata('cookie-policy');
}

export default function CookiePolicyPage() {
  return <LegalRoute slug="cookie-policy" />;
}
