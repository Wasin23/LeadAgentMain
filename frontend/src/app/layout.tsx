import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import QueryProvider from "@/components/QueryProvider";
import ScrollRestoration from "@/components/ScrollRestoration";

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
          <AuthProvider>
            <ScrollRestoration />
            {children}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
