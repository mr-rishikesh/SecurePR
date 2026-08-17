import { HomePage } from '@/app/components/HomePage';
import { notFound } from 'next/navigation';

const regionMap: Record<string, string> = {
  us: 'United States',
  uk: 'United Kingdom',
  in: 'India',
  ca: 'Canada',
  au: 'Australia',
};

export function generateStaticParams() {
  return Object.keys(regionMap).map((region) => ({
    region,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ region: string }> }) {
  const { region } = await params;
  const regionName = regionMap[region];
  if (!regionName) return {};

  return {
    title: `DevInsight — AI-Powered PR Security Auditor (${regionName})`,
    description: `Automatically audit GitHub PRs for security vulnerabilities in ${regionName}. Powered by Groq LLM.`,
  };
}

export default async function RegionPage({ params }: { params: Promise<{ region: string }> }) {
  const { region } = await params;
  const regionName = regionMap[region];

  if (!regionName) {
    notFound();
  }

  return <HomePage region={region} regionName={regionName} />;
}
