'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { FadeIn, ScaleIn } from './AnimationWrapper';

export default function StudentAccessSection() {
  return (
    <section className="py-24 bg-card dark:bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <ScaleIn delay={0.2}>
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-white" />
          </div>
        </ScaleIn>
        <FadeIn delay={0.3}>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Are you a student?
          </h2>
        </FadeIn>
        <FadeIn delay={0.4}>
          <p className="text-lg text-slate-600 dark:text-muted-foreground mb-8">
            Join a learning module with your instructor's access code and start learning
          </p>
        </FadeIn>
        <FadeIn delay={0.5}>
          <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-6 text-lg">
            <Link href="/join">Join a Module</Link>
          </Button>
        </FadeIn>
      </div>
    </section>
  );
}
