"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Scale, AlertTriangle } from "lucide-react";

export default function TermsOfServicePage() {
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
            <Scale className="w-4 h-4 mr-2 text-purple-500" />
            Terms of Service
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Terms of
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Service
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
                1. Acceptance of Terms
              </h2>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                By accessing and using AI Education Pilot (&quot;the Platform&quot;), you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these Terms of Service, please do not use the Platform.
              </p>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">2. Open Source License</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                AI Education Pilot is open-source software licensed under the MIT License. You are free to:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mb-6">
                <li>Use the software for any purpose (commercial or non-commercial)</li>
                <li>Modify the software</li>
                <li>Distribute the software</li>
                <li>Sublicense the software</li>
                <li>Use the software privately</li>
              </ul>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">3. User Accounts</h2>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">3.1 Account Creation</h3>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mb-6">
                <li>You must provide accurate and complete information when creating an account</li>
                <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                <li>You are responsible for all activities that occur under your account</li>
                <li>You must notify us immediately of any unauthorized use of your account</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">3.2 Account Eligibility</h3>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mb-6">
                <li>Teachers and educational staff must verify their affiliation with an educational institution</li>
                <li>Students under 13 must have parental or school consent (COPPA compliance)</li>
                <li>You must not create accounts using false information</li>
              </ul>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">4. Acceptable Use</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">You agree NOT to:</p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mb-6">
                <li>Use the Platform for any illegal or unauthorized purpose</li>
                <li>Violate any laws in your jurisdiction</li>
                <li>Transmit any malicious code or viruses</li>
                <li>Attempt to gain unauthorized access to the Platform or other users&apos; accounts</li>
                <li>Impersonate any person or entity</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Scrape, copy, or harvest data without permission</li>
                <li>Interfere with the proper functioning of the Platform</li>
              </ul>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">5. Educational Content</h2>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">5.1 User-Generated Content</h3>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mb-6">
                <li>Teachers retain all rights to modules, questions, and content they create</li>
                <li>Students retain rights to their answers and submissions</li>
                <li>By uploading content, you grant us a license to store, display, and process it for Platform functionality</li>
                <li>You are responsible for ensuring you have rights to any content you upload</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">5.2 AI-Generated Content</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                The Platform uses AI (OpenAI GPT-4) to generate feedback and insights. AI-generated content is provided &quot;as is&quot; and should be reviewed by educators before use. We are not responsible for the accuracy of AI-generated content.
              </p>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">6. Privacy and Data Protection</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Our collection and use of personal information is governed by our Privacy Policy. By using the Platform, you consent to our Privacy Policy.
              </p>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">7. Third-Party Services</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                The Platform integrates with third-party services:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mb-6">
                <li>OpenAI (for AI feedback generation)</li>
                <li>Supabase (for data storage and authentication)</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Use of these services is subject to their respective terms and privacy policies.
              </p>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
                8. Disclaimer of Warranties
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                THE PLATFORM IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE. USE AT YOUR OWN RISK.
              </p>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">9. Limitation of Liability</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF YOUR USE OF THE PLATFORM.
              </p>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">10. Educational Institution Agreements</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Educational institutions using the Platform must ensure compliance with:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mb-6">
                <li>FERPA (Family Educational Rights and Privacy Act)</li>
                <li>COPPA (Children&apos;s Online Privacy Protection Act)</li>
                <li>State and local education privacy laws</li>
                <li>Institutional data protection policies</li>
              </ul>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">11. Termination</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                We may terminate or suspend your account at any time for:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mb-6">
                <li>Violation of these Terms of Service</li>
                <li>Illegal activity</li>
                <li>Request from law enforcement</li>
                <li>Extended period of inactivity</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                You may terminate your account at any time by contacting us or deleting it through the Platform settings.
              </p>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">12. Self-Hosted Instances</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                If you self-host the Platform on your own infrastructure:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2 mb-6">
                <li>These Terms apply only to our hosted service</li>
                <li>You are responsible for your own compliance and data protection</li>
                <li>You may modify the software as permitted by the MIT License</li>
                <li>We provide no warranties or support for self-hosted instances</li>
              </ul>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">13. Changes to Terms</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                We reserve the right to modify these Terms at any time. We will notify users of material changes via email or Platform notification. Your continued use after changes constitutes acceptance of the new Terms.
              </p>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">14. Governing Law</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions.
              </p>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-12">15. Contact Information</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                For questions about these Terms, contact us:
              </p>
              <ul className="list-none text-gray-600 dark:text-gray-400 space-y-2">
                <li>Email: legal@aieducationpilot.com</li>
                <li>GitHub: <a href="https://github.com/All-Pilot-Modules/ai-pilot/issues" className="text-blue-600 hover:underline">Report an issue</a></li>
              </ul>

              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mt-12">
                <p className="text-gray-700 dark:text-gray-300 font-medium">
                  By using AI Education Pilot, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
                </p>
              </div>
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
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
