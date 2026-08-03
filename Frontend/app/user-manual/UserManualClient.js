'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Sparkles,
  GraduationCap,
  FileText,
  Bot,
  BarChart3,
  CheckCircle,
} from 'lucide-react';

export default function UserManualIntroduction() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
          Teacher&apos;s User Manual
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          A comprehensive guide to using the AI Education Pilot platform for creating, managing, and grading educational modules.
        </p>
        <Badge variant="outline" className="mt-4">
          <GraduationCap className="w-3 h-3 mr-1" />
          For Teachers
        </Badge>
      </div>

      {/* What is AI Education Pilot */}
      <Card className="border-2 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Sparkles className="w-5 h-5" />
            What is AI Education Pilot?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>
            AI Education Pilot is an AI-powered educational platform that helps teachers create, manage, and grade course modules efficiently. The platform leverages artificial intelligence to:
          </p>
          <ul className="space-y-3">
            {[
              'Automatically generate questions from uploaded documents',
              'Provide personalized AI feedback on student submissions',
              'Grade submissions using configurable rubrics and AI scoring',
              'Offer an AI chatbot for students to interact with course materials',
              'Track student progress with detailed analytics',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Platform Overview */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Platform Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              icon: FileText,
              title: 'Document Processing',
              description: 'Upload PDFs, DOCX, or text files. The AI processes and indexes your content for question generation and chatbot training.',
              color: 'blue',
            },
            {
              icon: Bot,
              title: 'AI-Powered Features',
              description: 'Automatic question generation, intelligent grading, personalized feedback, and an interactive student chatbot.',
              color: 'purple',
            },
            {
              icon: GraduationCap,
              title: 'Student Management',
              description: 'Students join via access codes. Track their progress, view submissions, and monitor engagement.',
              color: 'green',
            },
            {
              icon: BarChart3,
              title: 'Analytics & Insights',
              description: 'Comprehensive dashboards showing grade distributions, student progress, and module performance.',
              color: 'orange',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg bg-${item.color}-100 dark:bg-${item.color}-900/30 flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 text-${item.color}-600 dark:text-${item.color}-400`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{item.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* How to Use This Manual */}
      <Card className="bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-800 dark:to-gray-800/50">
        <CardContent className="p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">How to Use This Manual</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Navigate through the sections using the sidebar on the left (or the menu button on mobile). Each section covers a specific feature of the platform with step-by-step instructions.
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-500">
            Tip: Start with &quot;Getting Started&quot; if you&apos;re new to the platform, or jump directly to any section you need help with.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
