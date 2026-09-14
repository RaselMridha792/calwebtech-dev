import type { Metadata } from 'next';
import { LegalRoute, legalPageMetadata } from '@/components/static/legal-route';

export function generateMetadata(): Promise<Metadata> {
  return legalPageMetadata('information-security');
}

export default function InformationSecurityPage() {
  return <LegalRoute slug="information-security" />;
}
