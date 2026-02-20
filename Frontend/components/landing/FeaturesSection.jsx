'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight, BarChart3, Sparkles, Brain, Zap, ChevronRight, MessageSquare, BookOpen, Layers, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { FadeIn, SlideInLeft, SlideInRight, ScaleIn, RotateIn } from './AnimationWrapper';

// Sub-component for the "Floating UI" look
function AnalyticCard() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-[80%] transform -rotate-2 hover:rotate-0 transition-transform duration-500">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
            <BarChart3 className="text-orange-500 w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="h-2 w-24 bg-slate-100 rounded" />
            <div className="h-2 w-16 bg-slate-50 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full bg-slate-100 rounded" />
          <div className="h-4 w-[90%] bg-slate-100 rounded" />
          <div className="h-4 w-[60%] bg-slate-50 rounded" />
        </div>
      </div>
      {/* Decorative floating bits */}
      <div className="absolute top-10 right-10 w-12 h-12 bg-orange-300 rounded-lg rotate-12 opacity-50" />
      <div className="absolute bottom-10 left-10 w-8 h-8 bg-white rounded-full opacity-40" />
    </div>
  );
}

function TestCreationCard() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-[80%] transform rotate-2 hover:rotate-0 transition-transform duration-500">
        <div className="flex justify-between items-center mb-6">
          <div className="h-4 w-32 bg-slate-900 rounded-full" />
          <Sparkles className="text-blue-500 w-5 h-5" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <div className="w-4 h-4 border-2 border-slate-200 rounded" />
            <div className={`h-2 bg-slate-100 rounded ${i === 1 ? 'w-full' : 'w-2/3'}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedbackCard() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-[80%] transform -rotate-2 hover:rotate-0 transition-transform duration-500">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <MessageSquare className="text-purple-500 w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="h-3 w-24 bg-slate-900 rounded mb-1" />
            <div className="h-2 w-16 bg-slate-200 rounded" />
          </div>
        </div>
        <div className="space-y-2 mb-4">
          <div className="h-3 w-full bg-slate-100 rounded" />
          <div className="h-3 w-[85%] bg-slate-100 rounded" />
          <div className="h-3 w-[70%] bg-slate-50 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-16 bg-green-100 rounded-full" />
          <div className="h-6 w-20 bg-blue-100 rounded-full" />
        </div>
      </div>
      <div className="absolute top-12 right-8 w-10 h-10 bg-purple-300 rounded-full opacity-40" />
      <div className="absolute bottom-12 left-8 w-6 h-6 bg-white rounded-lg rotate-45 opacity-30" />
    </div>
  );
}

function ModuleCard() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-[80%] transform rotate-2 hover:rotate-0 transition-transform duration-500">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="text-teal-500 w-5 h-5" />
            <div className="h-3 w-24 bg-slate-900 rounded" />
          </div>
          <div className="h-6 w-6 bg-teal-100 rounded flex items-center justify-center">
            <div className="h-1 w-3 bg-teal-500" />
          </div>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-50 rounded-lg p-3 mb-2">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="text-slate-400 w-4 h-4" />
              <div className={`h-2 bg-slate-200 rounded ${i === 1 ? 'w-28' : i === 2 ? 'w-20' : 'w-24'}`} />
            </div>
            <div className="h-1.5 w-16 bg-slate-100 rounded ml-6" />
          </div>
        ))}
      </div>
      <div className="absolute top-10 left-10 w-8 h-8 bg-teal-300 rounded-lg -rotate-12 opacity-40" />
    </div>
  );
}

function QuestionTypesCard() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-[80%] transform -rotate-2 hover:rotate-0 transition-transform duration-500">
        <div className="space-y-3">
          {/* MCQ */}
          <div className="border-2 border-slate-100 rounded-lg p-3">
            <div className="h-2 w-32 bg-slate-900 rounded mb-2" />
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-slate-300 rounded-full" />
              <div className="h-1.5 w-24 bg-slate-100 rounded" />
            </div>
          </div>
          {/* True/False */}
          <div className="border-2 border-slate-100 rounded-lg p-3">
            <div className="h-2 w-28 bg-slate-900 rounded mb-2" />
            <div className="flex gap-3">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <div className="h-1.5 w-8 bg-slate-100 rounded" />
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 border-2 border-slate-200 rounded-full" />
                <div className="h-1.5 w-10 bg-slate-100 rounded" />
              </div>
            </div>
          </div>
          {/* Essay */}
          <div className="border-2 border-slate-100 rounded-lg p-3">
            <div className="h-2 w-20 bg-slate-900 rounded mb-2" />
            <div className="space-y-1">
              <div className="h-1.5 w-full bg-slate-50 rounded" />
              <div className="h-1.5 w-[90%] bg-slate-50 rounded" />
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-10 right-10 w-12 h-12 bg-yellow-300 rounded-full opacity-30" />
    </div>
  );
}

function MasteryCard() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-[80%] transform rotate-2 hover:rotate-0 transition-transform duration-500">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Zap className="text-pink-500 w-5 h-5" />
            <div className="h-3 w-20 bg-slate-900 rounded" />
          </div>
          <div className="px-3 py-1 bg-pink-100 rounded-full">
            <div className="h-2 w-12 bg-pink-500 rounded" />
          </div>
        </div>
        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full w-[70%] bg-gradient-to-r from-pink-400 to-pink-600 rounded-full" />
          </div>
        </div>
        {/* Streak indicators */}
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`w-8 h-8 rounded-lg ${
                i <= 3 ? 'bg-gradient-to-br from-pink-400 to-pink-500' : 'bg-slate-100'
              } flex items-center justify-center`}
            >
              {i <= 3 && <CheckCircle2 className="w-4 h-4 text-white" />}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute top-8 left-12 w-6 h-6 bg-pink-300 rounded-full opacity-50" />
      <div className="absolute bottom-8 right-8 w-10 h-10 bg-white rounded-lg -rotate-12 opacity-40" />
    </div>
  );
}

const features = [
  {
    label: "AI ANALYTICS",
    headline: "See exactly what your students need",
    description: "Real-time insights reveal learning gaps instantly.",
    bgColor: "bg-[#f3a952]", // Podia-style orange
    illustration: <AnalyticCard />,
    reverse: false
  },
  {
    label: "TEST CREATION",
    headline: "Generate assessments in seconds, not hours",
    description: "AI creates custom tests tailored to your curriculum. Spend less time on admin work and more time teaching.",
    bgColor: "bg-[#a8d3e6]", // Podia-style blue
    illustration: <TestCreationCard />,
    reverse: true
  },
  {
    label: "AI-POWERED FEEDBACK",
    headline: "Instant personalized feedback for every student",
    description: "AI analyzes student responses and provides detailed, customized feedback based on your rubrics. Students get immediate guidance to improve their learning.",
    bgColor: "bg-[#c5a8e6]", // Podia-style purple
    illustration: <FeedbackCard />,
    reverse: false
  },
  {
    label: "MODULE MANAGEMENT",
    headline: "Organize your courses with ease",
    description: "Create modules, generate access codes, and track enrollments all in one place. Simple tools that make course management effortless.",
    bgColor: "bg-[#a8e6d4]", // Podia-style mint green
    illustration: <ModuleCard />,
    reverse: true
  },
  {
    label: "FLEXIBLE ASSESSMENTS",
    headline: "Multiple question types for diverse learning",
    description: "From multiple choice to essays, create varied assessments that match your teaching style. Support for images, multi-part questions, and more.",
    bgColor: "bg-[#f3c952]", // Podia-style yellow
    illustration: <QuestionTypesCard />,
    reverse: false
  },
  {
    label: "AI + MANUAL GRADING",
    headline: "Best of both worlds: AI speed with human insight",
    description: "Let AI handle the initial grading instantly, then add your expert feedback and adjust scores as needed. Review student work with AI-generated insights, override grades where your judgment matters, and provide personalized comments. Perfect balance of automation and personalized teaching.",
    bgColor: "bg-[#e6a8b8]", // Podia-style pink
    illustration: <MasteryCard />,
    reverse: true
  }
];

export default function FeaturesSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="space-y-48">
          {features.map((feature, index) => {
            const ImageWrapper = feature.reverse ? SlideInRight : SlideInLeft;
            const TextWrapper = feature.reverse ? SlideInLeft : SlideInRight;

            return (
              <div
                key={index}
                className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center"
              >
                {/* Image Side */}
                <ImageWrapper className={`${feature.reverse ? 'lg:order-2' : 'lg:order-1'}`}>
                  <RotateIn duration={0.8} delay={0.2}>
                    <div className={`${feature.bgColor} rounded-[2.5rem] aspect-[4/3] flex items-center justify-center overflow-hidden shadow-sm`}>
                      {feature.illustration}
                    </div>
                  </RotateIn>
                </ImageWrapper>

                {/* Text Side */}
                <TextWrapper className={`${feature.reverse ? 'lg:order-1' : 'lg:order-2'}`}>
                  <div className="max-w-md">
                    <FadeIn delay={0.3}>
                      <p className="text-[11px] font-black tracking-[0.2em] text-slate-900 uppercase mb-4">
                        {feature.label}
                      </p>
                    </FadeIn>
                    <FadeIn delay={0.4}>
                      <h3 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tighter leading-[1.1] mb-6">
                        {feature.headline}
                      </h3>
                    </FadeIn>
                    <FadeIn delay={0.5}>
                      <p className="text-lg text-slate-600 leading-relaxed mb-8">
                        {feature.description}
                      </p>
                    </FadeIn>
                    <FadeIn delay={0.6}>
                      <Button
                        asChild
                        variant="ghost"
                        className="group h-auto p-0 hover:bg-transparent text-slate-900 font-bold text-lg inline-flex items-center"
                      >
                        <Link href="/user-manual">
                          <span className="bg-[#2d201c] text-white px-6 py-3 rounded-full flex items-center group-hover:bg-slate-800 transition-colors">
                            Learn more
                            <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </span>
                        </Link>
                      </Button>
                    </FadeIn>
                  </div>
                </TextWrapper>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}