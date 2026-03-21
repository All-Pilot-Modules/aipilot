'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FadeIn, Float } from './AnimationWrapper';

export default function Footer() {
  const footerLinks = [
    {
      title: 'RESOURCES',
      links: [
        { label: 'User Manual', href: '/user-manual' },
        { label: 'Help Center', href: '/help' },
        { label: 'About', href: '/about' },
      ]
    },
    {
      title: 'SUPPORT',
      links: [
        { label: 'Contact Us', href: '/contact' },
      ]
    },
  ];

  return (
    <footer className="w-full bg-white dark:bg-slate-950">
      {/* 1. Curved Top CTA Section */}
      <div className="relative bg-[#a8d3e6] dark:bg-slate-800 pt-24 pb-32 overflow-hidden">
        {/* The Arc - This creates the smooth curve at the top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-[120px] bg-white dark:bg-slate-950 rounded-[100%] transition-all" />

        {/* Decorative Floating Shapes (Inspired by image) */}
        <div className="absolute top-40 left-[10%] w-12 h-12 bg-white/60 rounded-full" />
        <div className="absolute top-60 left-[15%] w-10 h-10 bg-[#1a212c] -rotate-12 rounded-sm" />
        <div className="absolute bottom-20 left-[20%] w-14 h-14 bg-white/40 rotate-12" />
        <div className="absolute top-32 right-[15%] w-12 h-12 bg-[#1a212c] rotate-[30deg] clip-triangle" 
             style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
        <div className="absolute bottom-16 right-[10%] w-16 h-16 bg-[#1a212c] rounded-full opacity-90" />
        <div className="absolute top-1/2 right-[5%] w-8 h-8 bg-white/50 rounded-sm rotate-45" />

        {/* The White CTA Card */}
        <div className="relative z-10 max-w-4xl mx-auto px-6">
          <FadeIn delay={0.2}>
            <Float duration={5}>
              <div className="bg-white dark:bg-slate-700 rounded-[40px] p-12 md:p-20 text-center shadow-sm">
                <h2 className="text-3xl md:text-5xl font-bold text-[#1a212c] dark:text-white tracking-tighter leading-[1.1] mb-4">
                  Creating assignments is easier<br />when everything is in one place
                </h2>
                <p className="text-lg text-slate-600 dark:text-slate-300 mb-10">
                  Start building your AI-powered classroom today.
                </p>
                <Button
                  asChild
                  className="bg-[#1a212c] hover:bg-slate-800 text-white px-10 py-7 text-lg font-bold rounded-xl h-auto"
                >
                  <Link href="/sign-up">Get started</Link>
                </Button>
              </div>
            </Float>
          </FadeIn>
        </div>
      </div>

      {/* 2. Main Footer Links */}
      <div className="bg-[#a8d3e6] dark:bg-slate-900 pt-12 pb-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-20">
            {/* Brand Logo */}
            <div className="col-span-2 md:col-span-2">
              <Link href="/" className="text-2xl font-black text-[#1a212c] dark:text-white">
                ai pilot
              </Link>
            </div>

            {/* Link Columns */}
            {footerLinks.map((column) => (
              <div key={column.title} className="col-span-1">
                <h3 className="text-[11px] font-black tracking-widest text-[#1a212c] dark:text-slate-300 uppercase mb-6">
                  {column.title}
                </h3>
                <ul className="space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-[#1a212c] dark:text-slate-300 hover:underline text-sm font-medium opacity-80"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* 3. Bottom Bar */}
          <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-[#1a212c]/10 dark:border-slate-700">
            <div className="flex flex-col md:flex-row items-center gap-6 text-sm font-medium text-[#1a212c]/70 dark:text-slate-400">
              <span>AI Pilot, Inc. © {new Date().getFullYear()}</span>
              <div className="flex gap-6">
                <Link href="/terms" className="hover:text-[#1a212c] dark:hover:text-white">Terms</Link>
                <Link href="/privacy" className="hover:text-[#1a212c] dark:hover:text-white">Privacy</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}