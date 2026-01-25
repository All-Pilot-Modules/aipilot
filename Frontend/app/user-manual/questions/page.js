'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  HelpCircle,
  Sparkles,
  Plus,
  CheckCircle,
  Edit,
  Trash2,
  ListChecks,
  FileText,
  ToggleLeft,
} from 'lucide-react';

export default function QuestionsPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Questions</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Generate questions from documents, create manual questions, and manage your question bank.</p>
      </div>

      {/* AI Question Generation */}
      <Card className="border-2 border-indigo-200 dark:border-indigo-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
            <Sparkles className="w-5 h-5" />
            AI Question Generation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>To generate questions automatically:</p>
          <ol className="space-y-3 list-decimal list-inside">
            <li>Ensure you have uploaded and processed documents</li>
            <li>Navigate to the <strong>Questions</strong> section</li>
            <li>Click <strong>&quot;Generate Questions&quot;</strong></li>
            <li>Select the document(s) to generate from</li>
            <li>Choose the number of questions and types</li>
            <li>Click <strong>&quot;Generate&quot;</strong> and wait for the AI</li>
          </ol>
          <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-indigo-700 dark:text-indigo-300">
              <strong>Tip:</strong> Generated questions are marked as &quot;pending review&quot; by default. Review and approve them before they become available to students.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Question Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-blue-600" />
            Question Types
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>The platform supports multiple question types:</p>
          <div className="space-y-3 mt-3">
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">Short Answer</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Students provide a brief text response. AI grades based on rubric criteria.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <FileText className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">Long Answer / Essay</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Extended responses for deeper analysis. AI provides detailed feedback.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <ListChecks className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">Multiple Choice</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Select from predefined options. Auto-graded instantly.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Creation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-600" />
            Creating Questions Manually
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>To create a question manually:</p>
          <ol className="space-y-2 list-decimal list-inside">
            <li>Click <strong>&quot;Add Question&quot;</strong> in the Questions section</li>
            <li>Select the question type</li>
            <li>Enter the question text</li>
            <li>For multiple choice, add the answer options and mark the correct one</li>
            <li>Optionally add a model answer for AI grading reference</li>
            <li>Click <strong>&quot;Save&quot;</strong></li>
          </ol>
        </CardContent>
      </Card>

      {/* Review & Approval */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Reviewing & Approving Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>AI-generated questions require review before students can see them:</p>
          <div className="space-y-3 mt-3">
            <div className="flex items-center gap-3">
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">Pending</Badge>
              <span className="text-sm">Awaiting your review</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Approved</Badge>
              <span className="text-sm">Visible to students</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Rejected</Badge>
              <span className="text-sm">Will not be shown to students</span>
            </div>
          </div>
          <p className="mt-4">To review questions:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li>Click on a pending question to view details</li>
            <li>Edit the question text or answers if needed</li>
            <li>Click <strong>&quot;Approve&quot;</strong> or <strong>&quot;Reject&quot;</strong></li>
          </ul>
        </CardContent>
      </Card>

      {/* Editing & Deleting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-amber-600" />
            Editing & Deleting Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>You can modify questions at any time:</p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <Edit className="w-4 h-4 text-amber-500 mt-1 flex-shrink-0" />
              <span><strong>Edit</strong> - Update question text, options, or model answers</span>
            </li>
            <li className="flex items-start gap-2">
              <ToggleLeft className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
              <span><strong>Toggle visibility</strong> - Show or hide from students</span>
            </li>
            <li className="flex items-start gap-2">
              <Trash2 className="w-4 h-4 text-red-500 mt-1 flex-shrink-0" />
              <span><strong>Delete</strong> - Remove the question permanently</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
