import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import QueryProvider from "@/components/QueryProvider";
import ScrollRestoration from "@/components/ScrollRestoration";
import TrialCreditBanner from "@/components/TrialCreditBanner";

const inter = Inter({ subsets: ["latin"] });

const metadata: Metadata = {
  title: "Meridian - AI-Powered Lead Research & Automation",
  description: "AI-powered lead research and email automation platform",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning={true}>
        <QueryProvider>
          <ThemeProvider>
            <AuthProvider>
              <TrialCreditBanner />
              <ScrollRestoration />
              {children}
            </AuthProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
