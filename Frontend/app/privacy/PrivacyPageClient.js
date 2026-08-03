"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Shield, Lock, Eye, FileText } from "lucide-react";

export default function PrivacyPolicyPage() {
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

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-6 px-4 py-2 text-sm font-semibold">
            <Shield className="w-4 h-4 mr-2 text-blue-500" />
            Privacy Policy
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Your Privacy
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Matters to Us
            </span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Last updated: January 2025
          </p>
        </div>

        <Card className="border-0 shadow-lg mb-8">
          <CardContent className="p-12">
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-500" />
                Introduction
              </h2>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                AI Education Pilot (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. As an open-source educational platform, we believe in transparency and giving you control over your data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
              </p>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12 flex items-center gap-2">
                <Eye className="w-6 h-6 text-purple-500" />
                Information We Collect
              </h2>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">1. Personal Information</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">We collect information that you provide directly to us:</p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mb-6">
                <li>Account information (username, email address, password)</li>
                <li>Profile information (name, role - teacher or student)</li>
                <li>Student ID numbers (for enrollment tracking)</li>
                <li>Module and course data</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">2. Educational Data</h3>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mb-6">
                <li>Test answers and submissions</li>
                <li>Progress and performance metrics</li>
                <li>Feedback and AI-generated insights</li>
                <li>Chat messages with AI assistant</li>
                <li>Survey responses</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">3. Usage Information</h3>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mb-6">
                <li>Device information and browser type</li>
                <li>IP address and location data</li>
                <li>Usage patterns and preferences</li>
                <li>Log files and analytics data</li>
              </ul>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12 flex items-center gap-2">
                <Lock className="w-6 h-6 text-green-500" />
                How We Use Your Information
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">We use the information we collect to:</p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mb-6">
                <li>Provide, maintain, and improve our platform</li>
                <li>Generate AI-powered insights and feedback</li>
                <li>Authenticate users and maintain security</li>
                <li>Track student progress and performance</li>
                <li>Communicate with you about updates and features</li>
                <li>Analyze usage patterns to improve user experience</li>
                <li>Comply with legal obligations and FERPA requirements</li>
              </ul>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">Data Security</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                We implement appropriate technical and organizational measures to protect your data:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mb-6">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure password hashing (bcrypt)</li>
                <li>JWT-based authentication</li>
                <li>Regular security audits</li>
                <li>Access controls and permission systems</li>
              </ul>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">Data Sharing and Disclosure</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                We do not sell, trade, or rent your personal information. We may share data only in these limited circumstances:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mb-6">
                <li>With teachers and instructors (for students in their modules)</li>
                <li>With third-party AI services (OpenAI) for generating feedback</li>
                <li>When required by law or to protect our rights</li>
                <li>With your explicit consent</li>
              </ul>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">Your Rights</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">You have the right to:</p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mb-6">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data</li>
                <li>Opt-out of certain data collection</li>
                <li>Withdraw consent at any time</li>
              </ul>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">FERPA Compliance</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                For educational institutions in the United States, we comply with the Family Educational Rights and Privacy Act (FERPA). Student educational records are protected and only disclosed as permitted by FERPA regulations.
              </p>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">Data Retention</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                We retain your data for as long as your account is active or as needed to provide services. You can request deletion of your data at any time. Some data may be retained for legal compliance purposes even after deletion.
              </p>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">Children&apos;s Privacy</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Our platform is designed for educational use and may be used by minors under the supervision of teachers. We comply with COPPA (Children&apos;s Online Privacy Protection Act) and obtain appropriate consent from schools and parents.
              </p>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">Self-Hosting and Data Control</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                As an open-source platform, you can self-host AI Education Pilot on your own servers. When self-hosting, YOU have complete control over all data, and this privacy policy applies only to our hosted service.
              </p>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">Changes to This Policy</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
              </p>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">Contact Us</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                If you have questions about this Privacy Policy, please contact us:
              </p>
              <ul className="list-none text-gray-600 dark:text-gray-400 space-y-2">
                <li>Email: privacy@aieducationpilot.com</li>
                <li>GitHub: <a href="https://github.com/All-Pilot-Modules/ai-pilot" className="text-blue-600 hover:underline">Report an issue</a></li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 border-t border-gray-800 mt-20">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-sm">
            <p>© 2024 AI Education Pilot. Open source and free forever.</p>
            <div className="mt-4 space-x-6">
              <Link href="/about" className="hover:text-white transition-colors">About</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
