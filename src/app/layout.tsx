import type { Metadata } from "next";
import "@xyflow/react/dist/style.css";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "CodeFlow",
  description: "Blueprint-first coding workbench."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
