// client/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // This now imports the correct Tailwind styles
import { Providers } from "./providers"; // This imports our theme manager

const inter = Inter({ subsets: ["latin"] }); // This keeps your friend's nice font

export const metadata = {
  title: "CareerNest",
  description: "CareerNest University Networking Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning is needed for next-themes
    <html lang="en" suppressHydrationWarning> 
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased`} suppressHydrationWarning>
        {/* This wrapper applies the theme to your entire site */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}