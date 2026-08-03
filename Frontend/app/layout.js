import { Geist, Geist_Mono, Lora } from "next/font/google";
import "./globals.css";

import { Analytics } from "@vercel/analytics/next"
import { ClientProviders } from "@/components/ClientProviders";
import Script from 'next/script';
import { SITE_URL, SITE_NAME } from "@/lib/siteConfig";


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

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — AI-Powered Feedback for Student Learning`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "AI-powered education and learning platform for students and teachers. Build courses and assessments in seconds with an AI-guided workflow and get instant, personalized feedback on assignments.",
  keywords: [
    "AI education platform",
    "AI feedback for students",
    "AI grading assistant",
    "SUNY Brockport AI Pilot",
    "AI-powered assessments",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — AI-Powered Feedback for Student Learning`,
    description:
      "AI-powered education platform that gives students instant, personalized feedback on their assignments.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — AI-Powered Feedback for Student Learning`,
    description:
      "AI-powered education platform that gives students instant, personalized feedback on their assignments.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description:
    "AI-powered education and learning platform for students and teachers.",
  creator: {
    "@type": "Person",
    name: "Yubraj Khatri",
    url: "https://yubrajkhatri.com.np",
  },
  mainEntityOfPage: {
    "@type": "EducationalOrganization",
    name: "SUNY Brockport",
    sameAs: "https://www.brockport.edu",
  },
};

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
  .replace(/\/$/, '')
  .replace(/^(https?:\/\/[^/]+).*$/, '$1');

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href={apiOrigin} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} antialiased`}
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
