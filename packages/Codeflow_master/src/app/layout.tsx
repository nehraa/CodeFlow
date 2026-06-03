import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Codeflow IDE',
  description: 'Unified Codeflow IDE - Canvas-centric development environment with blueprint generation, agent orchestration, and digital twin simulation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}