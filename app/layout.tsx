import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DevInsight — AI-Powered PR Security Auditor',
  description:
    'Automatically audit every Pull Request for SQL injection, hardcoded secrets, and insecure dependencies using Gemini 1.5 Flash.',
  openGraph: {
    title: 'DevInsight',
    description: 'AI-powered security audits for every GitHub PR.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full bg-black text-[#ededed] antialiased">{children}</body>
    </html>
  );
}
