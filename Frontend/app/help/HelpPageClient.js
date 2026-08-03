'use client';

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, Book, MessageCircle, FileText, ArrowLeft, Users, GraduationCap, BookOpen, Sparkles, BarChart } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-gray-950 dark:via-blue-950/10 dark:to-purple-950/10">
      {/* Simple Header */}
     

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl items-center justify-center mx-auto mb-6 shadow-xl">
            <HelpCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Help Center
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Everything you need to know about using AI Education Pilot
          </p>
        </div>

        {/* Quick Start Guide */}
        <Card className="mb-12 border-2 border-emerald-200 dark:border-emerald-700 shadow-lg bg-gradient-to-br from-emerald-50/50 to-green-50/30 dark:from-emerald-950/20 dark:to-green-950/10">
          <CardHeader className="border-b-2 border-emerald-200 dark:border-emerald-700">
            <CardTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100 text-2xl">
              <Sparkles className="w-6 h-6" />
              Quick Start Guide
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4 p-6 rounded-xl bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-lg">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2 text-lg">Create Your Account</h4>
                  <p className="text-gray-600 dark:text-gray-400">Sign up for free and create your educator or student account</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-6 rounded-xl bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-lg">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2 text-lg">Create a Module</h4>
                  <p className="text-gray-600 dark:text-gray-400">Set up your first learning module and add questions</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-6 rounded-xl bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-lg">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2 text-lg">Configure AI Grading</h4>
                  <p className="text-gray-600 dark:text-gray-400">Set up your rubric and AI feedback settings</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-6 rounded-xl bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-lg">
                  4
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2 text-lg">Invite Students</h4>
                  <p className="text-gray-600 dark:text-gray-400">Share your module access code with students</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Features */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Main Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-2 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                  <Book className="w-5 h-5" />
                  Modules
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  Create and manage educational modules. Organize courses and track student progress all in one place.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-200 dark:border-purple-800 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-900 dark:text-purple-100">
                  <FileText className="w-5 h-5" />
                  Questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  Create MCQ, short answer, and long answer questions with AI-powered grading and instant feedback.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-200 dark:border-green-800 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
                  <Users className="w-5 h-5" />
                  Students
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  Monitor student performance, view submissions, and provide personalized feedback with AI assistance.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-indigo-200 dark:border-indigo-800 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
                  <Sparkles className="w-5 h-5" />
                  AI Grading
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  Configure AI rubrics with custom criteria, weights, and thresholds for automated grading.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-orange-200 dark:border-orange-800 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
                  <BarChart className="w-5 h-5" />
                  Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  View comprehensive performance metrics and insights across all your modules and students.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-teal-200 dark:border-teal-800 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-teal-900 dark:text-teal-100">
                  <GraduationCap className="w-5 h-5" />
                  Resources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  Access learning materials, documentation, and support from our research lab.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQ Section */}
        <Card className="mb-12 border-2 border-gray-200 dark:border-gray-700">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="p-5 rounded-lg bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500">
              <h4 className="font-bold mb-2 text-blue-900 dark:text-blue-100 text-lg">How do I get started?</h4>
              <p className="text-gray-700 dark:text-gray-300">
                Sign up for a free account, create your first module, add questions, configure AI grading, and share the access code with students.
              </p>
            </div>
            <div className="p-5 rounded-lg bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500">
              <h4 className="font-bold mb-2 text-green-900 dark:text-green-100 text-lg">How do students join?</h4>
              <p className="text-gray-700 dark:text-gray-300">
                Students can join using the unique access code provided for each module. They can enter the code at the /join page.
              </p>
            </div>
            <div className="p-5 rounded-lg bg-purple-50 dark:bg-purple-950/20 border-l-4 border-purple-500">
              <h4 className="font-bold mb-2 text-purple-900 dark:text-purple-100 text-lg">How does AI grading work?</h4>
              <p className="text-gray-700 dark:text-gray-300">
                Configure your rubric with grading criteria and weights. The AI evaluates answers based on your settings and provides detailed feedback.
              </p>
            </div>
            <div className="p-5 rounded-lg bg-orange-50 dark:bg-orange-950/20 border-l-4 border-orange-500">
              <h4 className="font-bold mb-2 text-orange-900 dark:text-orange-100 text-lg">Is it really free?</h4>
              <p className="text-gray-700 dark:text-gray-300">
                Yes! AI Education Pilot is 100% free and open source under the MIT license. You can self-host it or use our hosted version.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact Section */}
        <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10">
          <CardContent className="p-8 text-center">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Need More Help?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
              Visit our research lab for comprehensive documentation and community support.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
                <a href="https://brockportsigai.org" target="_blank" rel="noopener noreferrer">
                  <BookOpen className="w-5 h-5 mr-2" />
                  Visit Research Lab
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/contact">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Contact Support
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Simple Footer */}
      <footer className="border-t bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600 dark:text-gray-400">
            <p className="mb-4">AI Education Pilot - Open Source Education Platform</p>
            <div className="flex justify-center gap-6 text-sm">
              <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">Home</Link>
              <Link href="/about" className="hover:text-blue-600 dark:hover:text-blue-400">About</Link>
              <Link href="/privacy" className="hover:text-blue-600 dark:hover:text-blue-400">Privacy</Link>
              <Link href="/terms" className="hover:text-blue-600 dark:hover:text-blue-400">Terms</Link>
              <Link href="/contact" className="hover:text-blue-600 dark:hover:text-blue-400">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
