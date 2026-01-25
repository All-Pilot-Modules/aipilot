'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckSquare,
  Bot,
  Edit,
  MessageSquare,
  Eye,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';

export default function GradingPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Grading</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Review student submissions, view AI scores, and manually override grades as needed.</p>
      </div>

      {/* Grading Overview */}
      <Card className="border-2 border-rose-200 dark:border-rose-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <CheckSquare className="w-5 h-5" />
            Grading Interface Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>The grading interface shows all student submissions organized by:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong>Student</strong> - Group submissions by student</li>
            <li><strong>Question</strong> - Group submissions by question</li>
            <li><strong>Status</strong> - Filter by graded/ungraded</li>
            <li><strong>Date</strong> - Sort by submission time</li>
          </ul>
        </CardContent>
      </Card>

      {/* AI Scoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-600" />
            AI Scoring
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>When a student submits an answer, the AI automatically:</p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span><strong>Analyzes the response</strong> against the question and rubric</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span><strong>Retrieves relevant context</strong> from your documents</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span><strong>Assigns a score</strong> based on your grading criteria</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span><strong>Generates feedback</strong> explaining the grade</span>
            </li>
          </ul>
          <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              Multiple choice questions are graded instantly and automatically. Essay and short answer questions use AI analysis.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Viewing Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            Viewing Submissions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Click on any submission to view:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li>The original question</li>
            <li>Student&apos;s answer</li>
            <li>AI-assigned score</li>
            <li>AI-generated feedback</li>
            <li>Relevant document excerpts used for grading</li>
            <li>Submission timestamp</li>
          </ul>
        </CardContent>
      </Card>

      {/* Manual Override */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-amber-600" />
            Manual Grade Override
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>You can override AI grades at any time:</p>
          <ol className="space-y-2 list-decimal list-inside">
            <li>Open the submission you want to modify</li>
            <li>Click <strong>&quot;Edit Grade&quot;</strong></li>
            <li>Enter your new score</li>
            <li>Optionally add a comment explaining the change</li>
            <li>Click <strong>&quot;Save&quot;</strong></li>
          </ol>
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <strong>Note:</strong> Manual overrides are marked with a badge so you can track which grades were adjusted.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Adding Comments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-600" />
            Adding Comments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Add your own comments to any submission:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li>Click the <strong>&quot;Add Comment&quot;</strong> button</li>
            <li>Type your feedback or notes</li>
            <li>Choose whether the comment is visible to the student</li>
            <li>Save your comment</li>
          </ul>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Teacher comments appear alongside AI feedback, giving students additional guidance.
          </p>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-indigo-600" />
            Bulk Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>For efficiency, you can perform bulk actions:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong>Select multiple submissions</strong> using checkboxes</li>
            <li><strong>Re-grade</strong> - Request AI to re-evaluate selected submissions</li>
            <li><strong>Export</strong> - Download grades as CSV</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
