'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Bot,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
  Sparkles,
} from 'lucide-react';

export default function FeedbackPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">AI Feedback</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Understand how AI feedback works, track generation status, and manage feedback critiques.</p>
      </div>

      {/* How AI Feedback Works */}
      <Card className="border-2 border-violet-200 dark:border-violet-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
            <Bot className="w-5 h-5" />
            How AI Feedback Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>When a student submits an answer, the AI generates personalized feedback:</p>
          <ol className="space-y-3 list-decimal list-inside">
            <li>The AI analyzes the student&apos;s response</li>
            <li>It retrieves relevant context from your course documents</li>
            <li>Based on your rubric settings, it evaluates the answer</li>
            <li>It generates constructive feedback in your chosen tone</li>
            <li>The feedback is delivered to the student</li>
          </ol>
        </CardContent>
      </Card>

      {/* Feedback Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Feedback Generation Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Track the status of AI feedback generation:</p>
          <div className="space-y-3 mt-3">
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Pending</Badge>
              <span className="text-sm">Waiting in queue for processing</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">Processing</Badge>
              <span className="text-sm">AI is analyzing and generating feedback</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Completed</Badge>
              <span className="text-sm">Feedback successfully generated</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Failed</Badge>
              <span className="text-sm">Generation failed - can be retried</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Retrying Failed Feedback */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-amber-600" />
            Retrying Failed Feedback
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>If feedback generation fails:</p>
          <ol className="space-y-2 list-decimal list-inside">
            <li>Navigate to the <strong>Feedback</strong> section</li>
            <li>Filter by &quot;Failed&quot; status to see problematic submissions</li>
            <li>Click the <strong>&quot;Retry&quot;</strong> button on individual items</li>
            <li>Or use <strong>&quot;Retry All Failed&quot;</strong> for bulk retry</li>
          </ol>
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <strong>Tip:</strong> Failures are usually temporary. If retrying doesn&apos;t work after a few attempts, contact support.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Critiques */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Feedback Critiques
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Students can request critiques of their AI feedback:</p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span>Students click &quot;Request Critique&quot; on their feedback</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span>The AI re-evaluates the feedback for accuracy</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span>A detailed critique is generated</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span>You can review critiques in the Feedback Critiques section</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Viewing All Feedback */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-teal-600" />
            Managing Feedback
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>The Feedback section allows you to:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li>View all generated feedback across your module</li>
            <li>Filter by status, student, or question</li>
            <li>See processing times and queue status</li>
            <li>Identify patterns in feedback quality</li>
            <li>Export feedback data for review</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
