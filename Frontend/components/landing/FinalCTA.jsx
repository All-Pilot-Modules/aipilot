'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FadeIn, ScaleIn } from './AnimationWrapper';
import { useAuth } from '@/context/AuthContext';

export default function FinalCTA() {
  const { user, isAuthenticated } = useAuth();
  const dashboardHref = user?.role === 'student' ? '/student-dashboard' : '/dashboard';

  return (
    <section className="py-24 bg-gradient-to-r from-blue-600 to-indigo-600">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
        <FadeIn delay={0.2}>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Ready to Transform Your Classroom?
          </h2>
        </FadeIn>
        <FadeIn delay={0.3}>
          <p className="text-xl mb-8 text-blue-100">
            Join hundreds of educators using AI to improve student outcomes
          </p>
        </FadeIn>
        <ScaleIn delay={0.4}>
          {isAuthenticated ? (
            <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-6 text-lg">
              <Link href={dashboardHref}>Go to Dashboard</Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-6 text-lg">
              <Link href="/sign-up">Get Started Free - No Credit Card Required</Link>
            </Button>
          )}
        </ScaleIn>
      </div>
    </section>
  );
}
