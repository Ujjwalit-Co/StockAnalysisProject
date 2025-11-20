import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stock Analysis",
  description: "A stock analysis dashboard to view and track Indian stock prices.",
  keywords: ["Stock Analysis", "Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui", "React", "Indian Stocks"],
  authors: [{ name: "Stock Analysis" }],
  icons: {
    icon: "https://freesvg.org/img/stock-market-graph.svg",
  },
  openGraph: {
    title: "Stock Analysis",
    description: "A stock analysis dashboard to view and track Indian stock prices.",
    url: "https://stock-analysis.vercel.app",
    siteName: "Stock Analysis",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stock Analysis",
    description: "A stock analysis dashboard to view and track Indian stock prices.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
