'use client';

import { FadeIn, SlideInLeft } from './AnimationWrapper';

const brands = [
  { name: " Brockport", logo: "SUNY" },
  // { name: "", logo: "SC" },
  // { name: "Institute of Learning", logo: "IOL" },
  // { name: "Academic Center", logo: "AC" },
  // { name: "Education Institute", logo: "EI" },
  { name: "Learning Academy", logo: "LA" },
];

const stats = [
  { value: "10+", label: "Educators", color: "text-[#f3a952]" },
  { value: "600+", label: "Students", color: "text-[#a8d3e6]" },
  { value: "50+", label: "Assessments", color: "text-[#d4e6a8]" },
  { value: "95%", label: "Satisfaction", color: "text-[#e6a8d3]" }
];

export default function BrandSection() {
  return (
    <section className="py-24 bg-[#EEF2FF] border-y border-slate-200/50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 w-full">

        {/* Section Header */}
        <FadeIn className="text-center mb-16">
          <p className="text-[11px] font-black tracking-[0.3em] text-slate-400 uppercase">
            Trusted by educators worldwide
          </p>
        </FadeIn>

        {/* Logo Carousel - Pro Level Infinite Scroll Effect */}
        <div className="relative group">
          {/* Fading Edges Mask */}
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#EEF2FF] to-transparent z-10" />
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#EEF2FF] to-transparent z-10" />

          <div className="flex gap-12 items-center animate-scroll whitespace-nowrap">
            {/* Duplicating brands for seamless loop */}
            {[...brands, ...brands].map((brand, index) => (
              <div
                key={index}
                className="flex items-center gap-3 px-8 py-4 bg-white/50 rounded-2xl border border-white shadow-sm hover:shadow-md transition-all duration-300 group/item grayscale hover:grayscale-0"
              >
                <span className="text-2xl font-black text-[#1a212c] opacity-80">{brand.logo}</span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter whitespace-nowrap">
                  {brand.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Row - Bold & Minimalist */}
        <div className="mt-24 grid grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {stats.map((stat, idx) => (
            <FadeIn key={idx} delay={idx * 0.1}>
              <div className="relative flex flex-col items-center lg:items-start group">
                {/* Decorative background number (Pro detail) */}
                <div className="absolute -top-6 -left-2 text-8xl font-black opacity-[0.03] pointer-events-none select-none">
                  {idx + 1}
                </div>

                <div className="text-5xl md:text-7xl font-black text-[#1a212c] tracking-tighter mb-2 transition-transform group-hover:-translate-y-1 duration-300">
                  {stat.value}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${stat.color.replace('text-', 'bg-')}`} />
                  <div className="text-sm font-black uppercase tracking-widest text-slate-400">
                    {stat.label}
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>

    </section>
  );
}