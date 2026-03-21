'use client';

import { Plus, Users, MessageSquareQuote, MousePointer2, Sparkles } from 'lucide-react';
import { FadeIn, StaggerContainer, StaggerItem } from './AnimationWrapper';

const steps = [
  {
    number: "01",
    title: "Create Your Module",
    description: "Build your course and assessments in seconds with an AI-guided workflow.",
    bgColor: "bg-[#f3a952]/10",
    accentColor: "bg-[#f3a952]",
    illustration: <CreateIllustration />
  },
  {
    number: "02",
    title: "Students Join",
    description: "A simple access code is all they need. No complex accounts or steep curves.",
    bgColor: "bg-[#a8d3e6]/20",
    accentColor: "bg-[#a8d3e6]",
    illustration: <JoinIllustration />
  },
  {
    number: "03",
    title: "Real AI Feedback",
    description: "Students get instant, personalized guidance on every assignment with AI.",
    bgColor: "bg-[#d4e6a8]/20",
    accentColor: "bg-[#d4e6a8]",
    illustration: <FeedbackIllustration />
  }
];

// Smaller, refined illustrations
function CreateIllustration() {
  return (
    <div className="relative w-full h-24 flex items-center justify-center">
      <div className="w-20 h-14 bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-2 transform -rotate-3">
        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-600 rounded-full mb-1.5" />
        <div className="w-3/4 h-1.5 bg-slate-50 dark:bg-slate-500 rounded-full" />
      </div>
      <div className="absolute -top-1 -right-1 w-8 h-8 bg-[#1a212c] rounded-lg flex items-center justify-center shadow-lg transform rotate-12">
        <Plus className="text-white w-4 h-4" />
      </div>
    </div>
  );
}

function JoinIllustration() {
  return (
    <div className="relative w-full h-24 flex items-center justify-center">
      <div className="flex -space-x-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-700 bg-slate-200 dark:bg-slate-600 shadow-sm" />
        ))}
      </div>
      <MousePointer2 className="absolute bottom-2 right-6 text-slate-900 dark:text-slate-300 w-5 h-5 fill-current" />
    </div>
  );
}

function FeedbackIllustration() {
  return (
    <div className="relative w-full h-24 flex items-center justify-center">
      <div className="w-14 h-14 bg-white dark:bg-slate-700 rounded-2xl shadow-md flex items-center justify-center relative">
        <MessageSquareQuote className="text-emerald-500 w-6 h-6" />
        <div className="absolute -top-1 -right-1">
          <Sparkles className="text-emerald-400 w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

export default function HowItWorksSection() {
  return (
    // Updated Background: Warm Cream (#FAF9F6)
    <section id="how-it-works" className="py-24 bg-[#FAF9F6] dark:bg-slate-900 overflow-hidden">
      <div className="max-w-6xl mx-auto px-8">
        <FadeIn className="text-center mb-20">
          <h2 className="text-4xl md:text-6xl font-black text-[#1a212c] dark:text-white tracking-tighter mb-4">
            Get started in minutes
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">No steep learning curves. Just simple, powerful tools.</p>
        </FadeIn>

        <div className="relative">
          {/* Subtle connecting line */}
          <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 border-t-2 border-dashed border-slate-200/60 dark:border-slate-700/60 -translate-y-32 z-0" />

          <StaggerContainer className="grid md:grid-cols-3 gap-8 lg:gap-12 relative z-10" staggerDelay={0.15}>
            {steps.map((step, idx) => (
              <StaggerItem key={step.number}>
                <div className={`
                  flex flex-col items-center text-center p-8 rounded-[2.5rem] 
                  transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.04)] hover:-translate-y-2 
                  bg-white dark:bg-slate-800 border border-white dark:border-slate-700 max-w-[320px] mx-auto
                  ${idx === 1 ? 'md:mt-12' : ''}
                `}>
                  
                  {/* Smaller Illustration Box */}
                  <div className={`w-full aspect-square max-w-[160px] ${step.bgColor} rounded-[2rem] flex items-center justify-center mb-8`}>
                    {step.illustration}
                  </div>

                  {/* Refined Number Badge */}
                  <div className={`inline-flex px-4 py-1 rounded-full ${step.accentColor} text-[#1a212c] text-[10px] font-black tracking-widest uppercase mb-6`}>
                    Step {step.number}
                  </div>

                  <h3 className="text-2xl font-bold text-[#1a212c] dark:text-white mb-3 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm font-medium">
                    {step.description}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </div>
    </section>
  );
}