import type { Metadata } from 'next';
import { LegalRoute, legalPageMetadata } from '@/components/static/legal-route';

export function generateMetadata(): Promise<Metadata> {
  return legalPageMetadata('privacy-policy');
}

export default function PrivacyPolicyPage() {
  return <LegalRoute slug="privacy-policy" />;
}
