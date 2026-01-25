'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardList,
  Settings,
  MessageSquare,
  Sliders,
  FileText,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export default function RubricPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Rubric & Feedback Config</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Configure how the AI grades submissions and generates feedback for students.</p>
      </div>

      {/* Overview */}
      <Card className="border-2 border-teal-200 dark:border-teal-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
            <Settings className="w-5 h-5" />
            Rubric Configuration Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>The rubric settings control how the AI evaluates student submissions. Access these settings from the <strong>Rubric</strong> section in your module.</p>
          <div className="bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
            <p className="text-sm text-teal-700 dark:text-teal-300">
              <strong>Tip:</strong> Take time to configure your rubric before students start submitting. This ensures consistent grading from the start.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Tone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-600" />
            Feedback Tone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Choose how the AI communicates with students:</p>
          <div className="space-y-3 mt-3">
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">Encouraging</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Positive, supportive feedback that motivates students</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">Neutral</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Objective, balanced feedback focusing on facts</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">Critical</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Direct feedback highlighting areas for improvement</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RAG Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            RAG Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>RAG (Retrieval-Augmented Generation) settings control how the AI uses your documents:</p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span><strong>Context retrieval</strong> - How much document context to include when grading</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span><strong>Relevance threshold</strong> - Minimum relevance score for retrieved content</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span><strong>Source citations</strong> - Whether to include document references in feedback</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Custom Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-600" />
            Custom Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Add custom instructions to guide the AI grading:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li>Specific criteria you want the AI to evaluate</li>
            <li>Keywords or concepts that must be included</li>
            <li>Common mistakes to watch for</li>
            <li>Grading scale preferences</li>
          </ul>
          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mt-4">
            <h4 className="font-medium text-orange-800 dark:text-orange-300 mb-2">Example Custom Instruction:</h4>
            <p className="text-sm text-orange-700 dark:text-orange-400 italic">
              &quot;Focus on whether the student demonstrates understanding of the core concepts. Deduct points for factual errors but be lenient on formatting. Encourage students to provide examples from the course materials.&quot;
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Grading Scale */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-green-600" />
            Grading Scale
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Configure your grading scale:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong>Points per question</strong> - Maximum points for each question</li>
            <li><strong>Passing threshold</strong> - Minimum score to pass</li>
            <li><strong>Grade boundaries</strong> - A, B, C, D, F thresholds</li>
          </ul>
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                The AI will use this scale when assigning scores. You can always manually adjust grades after review.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
