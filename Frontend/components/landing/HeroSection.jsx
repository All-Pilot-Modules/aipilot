'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { FadeIn, SlideInLeft, SlideInRight, ScaleIn, Float } from './AnimationWrapper';

export default function HeroSection() {
  return (
    <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 px-4 py-12 md:py-20">
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 lg:gap-20 items-center">
        
        {/* Left: Playful 3D Visual */}
        <SlideInLeft duration={0.8} className="order-2 md:order-1 flex justify-center items-center px-4 md:px-0">
          <Float duration={4}>
            <div className="relative w-full max-w-sm sm:max-w-md md:max-w-lg transition-transform hover:scale-105 duration-300">
              <Image
                src="/images/10312453.png"
                alt="AI Education Platform Illustration"
                width={600}
                height={600}
                priority
                className="w-full h-auto object-contain"
              />
            {/* Think Box - Positioned on left side - Hidden on mobile */}
            {/* dont remove this comendted code ever */}
            {/* <div
              className="hidden md:block absolute top-8 sm:top-12 md:top-16 left-0 sm:-left-4 md:-left-12 w-36 h-36 sm:w-48 sm:h-48 md:w-60 md:h-60"
              style={{
                animation: 'subtle-bounce 1s ease-in-out infinite',
              }}
            >
              <Image
                src="/images/thinkbox.png"
                alt="Thinking bubble"
                width={500}
                height={500}
                className="w-full h-auto object-contain scale-x-[-1]"
              />
             
              <div className="absolute inset-0 flex items-center justify-center px-2 sm:px-4">
                <p className="text-xs sm:text-sm md:text-base font-bold text-slate-800 text-center leading-tight">
                  Trust me bruh, <br/>I'm bot
                </p>
              </div>
            </div>

             */}
              {/* Soft Shadow */}
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-48 h-6 bg-slate-300/60 rounded-[100%] blur-xl" />
            </div>
          </Float>
        </SlideInLeft>

        {/* Right: Bold Minimalist Content */}
        <SlideInRight duration={0.8} className="order-1 md:order-2 flex flex-col items-center md:items-start text-center md:text-left space-y-6 px-4 md:px-0">
          <FadeIn delay={0.2} duration={0.8}>
            <h1 className="text-3xl sm:text-4xl md:text-4xl lg:text-5xl xl:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              <span className="whitespace-nowrap">AI-powered learning</span><br />
              that actually works.
            </h1>
          </FadeIn>

          <FadeIn delay={0.4} duration={0.8}>
            <p className="text-base sm:text-lg md:text-xl font-medium text-slate-600 dark:text-slate-300 max-w-md">
              Integrate AI in your teaching and learning
            </p>
          </FadeIn>

          <FadeIn delay={0.6} duration={0.8} className="flex flex-col gap-3 sm:gap-4 w-full max-w-sm">
            {/* Primary Action - Brand Emerald Green */}
            <Button
              asChild
              className="h-12 sm:h-14 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1 transition-all rounded-2xl text-base sm:text-lg font-bold uppercase tracking-wider shadow-lg"
            >
              <Link href="/sign-up">Get Started</Link>
            </Button>

            {/* Secondary Action - Outline Style */}
            <Button
              asChild
              variant="outline"
              className="h-12 sm:h-14 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 border-2 border-b-4 border-emerald-700 dark:border-emerald-600 hover:border-emerald-800 active:border-b-2 active:translate-y-1 transition-all rounded-2xl text-base sm:text-lg font-bold uppercase tracking-wider"
            >
              <Link href="/sign-in">I already have an account</Link>
            </Button>
          </FadeIn>
        </SlideInRight>


        
      </div>
    </section>
  );
}