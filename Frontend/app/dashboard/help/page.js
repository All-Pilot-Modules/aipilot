'use client';

import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, Book, MessageCircle, FileText, Users, GraduationCap, BookOpen, Sparkles, BarChart } from "lucide-react";
import Link from "next/link";

function HelpPageContent() {
  return (
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 lg:p-8">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="inline-flex w-16 h-16 bg-gray-900 rounded-2xl items-center justify-center mx-auto mb-4 shadow-lg">
              <HelpCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
              Help Center
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Everything you need to know about using AI Education Pilot
            </p>
          </div>

          {/* Quick Start Guide */}
          <Card className="mb-8 border-2 border-emerald-200 dark:border-emerald-700 shadow-lg bg-gradient-to-br from-emerald-50/50 to-green-50/30 dark:from-emerald-950/20 dark:to-green-950/10">
            <CardHeader className="border-b-2 border-emerald-200 dark:border-emerald-700">
              <CardTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100 text-xl">
                <Sparkles className="w-5 h-5" />
                Quick Start Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-4 p-5 rounded-xl bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Create Your Account</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Sign up for free and create your educator or student account</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-5 rounded-xl bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Create a Module</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Set up your first learning module and add questions</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-5 rounded-xl bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Configure AI Grading</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Set up your rubric and AI feedback settings</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-5 rounded-xl bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Invite Students</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Share your module access code with students</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Features */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Main Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="border-2 border-gray-200 dark:border-blue-800 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                    <Book className="w-5 h-5" />
                    Modules
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Create and manage educational modules. Organize courses and track student progress all in one place.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-200 dark:border-purple-800 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-900 dark:text-gray-100">
                    <FileText className="w-5 h-5" />
                    Questions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
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
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Monitor student performance, view submissions, and provide personalized feedback with AI assistance.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-200 dark:border-indigo-800 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
                    <Sparkles className="w-5 h-5" />
                    AI Grading
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
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
                  <p className="text-sm text-gray-600 dark:text-gray-400">
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
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Access learning materials, documentation, and support from our research lab.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* FAQ Section */}
          <Card className="mb-8 border-2 border-gray-200 dark:border-gray-700">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-xl">
                <HelpCircle className="w-5 h-5 text-gray-700 dark:text-gray-500" />
                Frequently Asked Questions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-blue-950/20 border-l-4 border-gray-400">
                <h4 className="font-bold mb-2 text-blue-900 dark:text-blue-100">How do I get started?</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Sign up for a free account, create your first module, add questions, configure AI grading, and share the access code with students.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500">
                <h4 className="font-bold mb-2 text-green-900 dark:text-green-100">How do students join?</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Students can join using the unique access code provided for each module. They can enter the code at the /join page.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-950/20 border-l-4 border-gray-400">
                <h4 className="font-bold mb-2 text-purple-900 dark:text-gray-100">How does AI grading work?</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Configure your rubric with grading criteria and weights. The AI evaluates answers based on your settings and provides detailed feedback.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20 border-l-4 border-orange-500">
                <h4 className="font-bold mb-2 text-orange-900 dark:text-orange-100">Is it really free?</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Yes! AI Education Pilot is 100% free and open source under the MIT license. You can self-host it or use our hosted version.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Section */}
          <Card className="border-2 border-gray-200 dark:border-blue-800 bg-gradient-to-br from-gray-800/50 to-gray-900/30 dark:from-gray-800/20 dark:to-gray-900/10">
            <CardContent className="p-6 text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-700 dark:text-gray-500" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Need More Help?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-2xl mx-auto">
                Visit our research lab for comprehensive documentation and community support.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild className="bg-gray-900 hover:bg-gray-900">
                  <a href="https://brockportsigai.org" target="_blank" rel="noopener noreferrer">
                    <BookOpen className="w-4 h-4 mr-2" />
                    Visit Research Lab
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/contact">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Contact Support
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
  );
}

export default function DashboardHelpPage() {
  return (
    <SidebarProvider>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      }>
        <AppSidebar />
      </Suspense>
      <SidebarInset>
        <Suspense fallback={
          <div className="flex items-center justify-center h-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>
          <SiteHeader />
        </Suspense>
        <HelpPageContent />
      </SidebarInset>
    </SidebarProvider>
  );
}
