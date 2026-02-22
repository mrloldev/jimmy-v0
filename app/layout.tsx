import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import "./globals.css";
import { SWRProvider } from "@/components/providers/swr-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ModelProvider } from "@/contexts/model-context";
import { StreamingProvider } from "@/contexts/streaming-context";

export const metadata: Metadata = {
  title: "Jimmy - AI for Developers",
  description:
    "Generate and preview UIs with AI. Built with ChatJimmy and Llama.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="antialiased">
        <ThemeProvider>
          <SWRProvider>
            <ModelProvider>
            <StreamingProvider>{children}</StreamingProvider>
          </ModelProvider>
          </SWRProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
