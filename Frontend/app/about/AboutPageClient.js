"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Github,
  Heart,
  Users,
  Globe,
  Sparkles,
  Target,
  BookOpen,
  Brain,
  GraduationCap,
  Shield,
  Zap
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-gray-950 dark:via-blue-950/10 dark:to-purple-950/10">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">AI</span>
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">AI Education Pilot</span>
            </Link>
            <Button variant="outline" asChild>
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-6 px-4 py-2 text-sm font-semibold">
            <Heart className="w-4 h-4 mr-2 text-red-500" />
            About Us
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Revolutionizing Education
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              with AI Technology
            </span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
            AI Education Pilot is a free, open-source platform empowering educators worldwide with cutting-edge AI analytics and personalized learning insights.
          </p>
        </div>

        {/* Mission Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Target className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Our Mission</h3>
              <p className="text-gray-600 dark:text-gray-400">
                To make AI-powered educational insights accessible to every educator and student, regardless of budget or technical expertise.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Our Vision</h3>
              <p className="text-gray-600 dark:text-gray-400">
                A world where every student receives personalized, data-driven education that adapts to their unique learning needs.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Our Values</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Open source, accessibility, privacy-first, and student-centered design guide everything we build.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Story Section */}
        <Card className="mb-20 border-0 shadow-lg">
          <CardContent className="p-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Our Story</h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-400 leading-relaxed">
              <p>
                AI Education Pilot was born from a simple observation: while AI technology has made incredible advances, most educational institutions still rely on outdated tools that don&apos;t leverage these breakthroughs.
              </p>
              <p>
                We started this project as a team of educators, developers, and AI researchers who believed that every teacher deserves access to the same powerful analytics tools used by large tech companies. We were tired of seeing expensive, proprietary solutions that only wealthy institutions could afford.
              </p>
              <p>
                Our solution? Build it ourselves and make it free and open source forever. No paywalls, no feature limitations, no vendor lock-in. Just powerful AI technology that anyone can use, modify, and improve.
              </p>
              <p>
                Today, AI Education Pilot helps educators understand their students better, identify learning gaps earlier, and provide personalized support at scale. And we&apos;re just getting started.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Features Highlight */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">
            What Makes Us Different
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Github className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">100% Open Source</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Complete transparency. Inspect the code, contribute improvements, or fork it for your own needs. MIT Licensed forever.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">AI-Powered Insights</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Advanced machine learning algorithms analyze patterns and predict outcomes to help you make better educational decisions.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Privacy First</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Your data stays yours. Self-host on your own servers with complete control over student information and compliance.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Community Driven</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Built by educators, for educators. Join our growing community of contributors making education better for everyone.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <Card className="border-0 shadow-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">Join the Education Revolution</h2>
            <p className="text-lg mb-8 text-blue-100 max-w-2xl mx-auto">
              Start using AI Education Pilot today. No credit card required, no setup fees, just powerful AI tools for education.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-blue-50">
                <Link href="/sign-up">
                  Get Started Free
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                <Link href="https://github.com/All-Pilot-Modules/ai-pilot" target="_blank">
                  <Github className="w-4 h-4 mr-2" />
                  View on GitHub
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 border-t border-gray-800 mt-20">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-sm">
              © 2024 AI Education Pilot. Open source and free forever.
            </p>
          </div>
        </div>
      </footer>
    </div>

    
  );
}
