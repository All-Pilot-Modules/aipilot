import dynamic from 'next/dynamic';
import HeroSection from './HeroSection';
import HowItWorksSection from './HowItWorksSection';
import BrandSection from './BrandSection';

// Lazy-load below-the-fold sections (user won't see these on initial paint)
const FeaturesSection = dynamic(() => import('./FeaturesSection'));
const TestimonialsSection = dynamic(() => import('./TestimonialsSection'));
const StudentAccessSection = dynamic(() => import('./StudentAccessSection'));
const Footer = dynamic(() => import('./Footer'));

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <main id="main-content">
        <HeroSection />
        <HowItWorksSection />
        <BrandSection />
        <FeaturesSection />
        {/* <TestimonialsSection /> */}
        <StudentAccessSection />
      </main>
      <Footer />
    </div>
  );
}


