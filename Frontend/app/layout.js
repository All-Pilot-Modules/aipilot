import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { ClientProviders } from "@/components/ClientProviders";
import Script from 'next/script';


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata = {
  title: "Ai Education Pilot",
  description: "AI-powered education and learning platform for students and teachers",
};

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
  .replace(/\/$/, '')
  .replace(/^(https?:\/\/[^/]+).*$/, '$1');

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href={apiOrigin} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientProviders>
          {children}
        </ClientProviders>
        <Analytics />
        {process.env.NEXT_PUBLIC_SITE24X7_RUM_KEY && (
          <Script
            id="site24x7-rum"
            strategy="afterInteractive"
            src={`https://rum.site24x7.com/rum.min.js?appKey=${process.env.NEXT_PUBLIC_SITE24X7_RUM_KEY}`}
          />
        )}
      </body>
    </html>
  );
}
