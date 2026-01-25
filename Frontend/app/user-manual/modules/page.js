'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FolderOpen,
  Plus,
  Settings,
  Key,
  Share2,
  Trash2,
  Copy,
  CheckCircle,
} from 'lucide-react';

export default function ModulesPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Modules</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Create and manage course modules, configure settings, and share access codes with students.</p>
      </div>

      {/* Creating a Module */}
      <Card className="border-2 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
            <Plus className="w-5 h-5" />
            Creating a Module
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>To create a new module:</p>
          <ol className="space-y-3 list-decimal list-inside">
            <li>Click the <strong>&quot;Create Module&quot;</strong> button on the dashboard</li>
            <li>Enter a descriptive <strong>module name</strong> (e.g., &quot;Introduction to Biology&quot;)</li>
            <li>Optionally add a <strong>description</strong> for additional context</li>
            <li>Click <strong>&quot;Create&quot;</strong> to generate your module</li>
          </ol>
          <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              Each module automatically receives a unique <strong>access code</strong> that students use to join.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Module Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Module Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Access module settings by clicking the settings icon or navigating to the Settings page within a module:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong>Module Name</strong> - Update the display name</li>
            <li><strong>Description</strong> - Add or edit the module description</li>
            <li><strong>Access Code</strong> - View or regenerate the student access code</li>
            <li><strong>Module Status</strong> - Active or archived</li>
          </ul>
        </CardContent>
      </Card>

      {/* Access Codes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-600" />
            Access Codes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Access codes allow students to join your module:</p>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <Copy className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">Copy Code</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Click the copy button next to the code to copy it to your clipboard</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <Share2 className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">Share with Students</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Share the code via email, LMS, or in class. Students enter it at the join page.</p>
              </div>
            </div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <strong>Regenerating codes:</strong> If you need to invalidate the current code, you can regenerate it in settings. This prevents new students from using the old code.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Managing Modules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-green-600" />
            Managing Modules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>From your module list, you can:</p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span>Click a module card to enter and manage that module</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span>View quick stats like student count and submission numbers</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span>Access the settings menu for each module</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Deleting Modules */}
      <Card className="border border-red-200 dark:border-red-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <Trash2 className="w-5 h-5" />
            Deleting a Module
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>To delete a module:</p>
          <ol className="space-y-2 list-decimal list-inside">
            <li>Open the module settings</li>
            <li>Scroll to the danger zone at the bottom</li>
            <li>Click <strong>&quot;Delete Module&quot;</strong></li>
            <li>Confirm the deletion in the dialog</li>
          </ol>
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-700 dark:text-red-300">
              <strong>Warning:</strong> Deleting a module permanently removes all associated documents, questions, student enrollments, and submissions. This action cannot be undone.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
