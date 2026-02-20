'use client';

import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { FadeIn, StaggerContainer, StaggerItem, ScaleIn } from './AnimationWrapper';

const testimonials = [
  {
    name: "Dr Jie Zhang",
    role: "EDUCATOR STORY",
    image: "https://www.brockport.edu/live/image/scale/2x/gid/38/width/250/height/375/crop/1/9776_Jie_Zhang.rev.1685726873.webp",
    bgColor: "bg-[#f3a952]", // Podia Orange
    quote: "AI Pilot transformed how I teach. Real-time insights help me identify struggling students instantly.",
    size: "large"
  },
  {
    name: "Dr. Yu Ning",
    role: "EDUCATOR STORY",
    image: "https://www.brockport.edu/live/image/gid/32/width/250/height/375/crop/1/8223_ning_yu.rev.1658924710.webp",
    bgColor: "bg-[#a8d3e6]", // Podia Blue
    quote: "The AI test creation saves me hours every week. I can finally focus on teaching.",
    size: "small"
  },
  {
    name: "Yubraj Khatri",
    role: "STUDENT STORY",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&h=800&fit=crop",
    bgColor: "bg-[#d4e6a8]", // Podia Green
    quote: "Instant feedback helped me go from struggling in stats to acing my final exam with a 95%!",
    size: "large"
  },
  {
    name: "Dr. Adam Rich",
    role: "EDUCATOR STORY",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=600&fit=crop",
    bgColor: "bg-[#e6a8d3]", // Podia Pink-ish
    quote: "Student engagement increased by 40% in just one semester after we adopted the dashboard.",
    size: "small"
  }
];

export default function TestimonialsSection() {
  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header - High Contrast Podia Style */}
        <FadeIn className="text-center mb-20">
          <h2 className="text-4xl md:text-7xl font-black text-[#1a212c] tracking-tighter leading-[1.05] mb-6">
            Trusted by the lots of <br />students & educators.
          </h2>
          <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto">
            Join thousands of teachers who have automated their admin work and focused back on their students.
          </p>
        </FadeIn>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-start">
          {testimonials.map((t, i) => (
            <StaggerItem key={i} className={t.size === 'large' ? 'lg:pt-12' : ''}>
              <div className="group cursor-pointer">
                {/* Image Container with Custom Podia Border Radius */}
                <div className={`relative ${t.bgColor} rounded-[2.5rem] overflow-hidden mb-6 aspect-[4/5] shadow-sm transition-transform duration-500 group-hover:-translate-y-2`}>
                  <Image
                    src={t.image}
                    alt={t.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 25vw"
                    className="object-cover mix-blend-multiply opacity-90 grayscale group-hover:grayscale-0 transition-all duration-700"
                  />
                  {/* Floating Quote Icon */}
                  <div className="absolute bottom-6 left-6 bg-white rounded-2xl p-4 shadow-xl max-w-[80%] opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                    <p className="text-xs font-bold text-[#1a212c] leading-tight italic">
                      "{t.quote}"
                    </p>
                  </div>
                </div>

                {/* Info Section */}
                <div className="px-2">
                  <p className="text-[11px] font-black tracking-[0.2em] text-[#1a212c] uppercase mb-2 opacity-60">
                    {t.role}
                  </p>
                  <h3 className="text-2xl font-bold text-[#1a212c] flex items-center gap-2 group-hover:gap-4 transition-all">
                    {t.name}
                    <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all text-emerald-600" />
                  </h3>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Bottom CTA for Testimonials */}
        <FadeIn className="mt-20 text-center">
            <button className="bg-[#1a212c] text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">
                Read all stories
            </button>
        </FadeIn>
      </div>
    </section>
  );
}