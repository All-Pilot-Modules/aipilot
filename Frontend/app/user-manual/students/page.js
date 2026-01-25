'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  UserPlus,
  Eye,
  BarChart3,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export default function StudentsPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Students</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">View enrolled students, track their progress, and manage student access.</p>
      </div>

      {/* How Students Join */}
      <Card className="border-2 border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <UserPlus className="w-5 h-5" />
            How Students Join
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Students enroll in your module using the access code:</p>
          <ol className="space-y-3 list-decimal list-inside">
            <li>Share your module&apos;s <strong>access code</strong> with students</li>
            <li>Students navigate to the join page</li>
            <li>They enter the access code and their details</li>
            <li>Once joined, they appear in your student list</li>
          </ol>
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-green-700 dark:text-green-300">
              <strong>Tip:</strong> You can find your access code in the module settings or on the module card on your dashboard.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Viewing Students */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            Viewing Enrolled Students
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>The Students page shows a list of all enrolled students with:</p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span><strong>Student name</strong> and email</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span><strong>Join date</strong> - when they enrolled</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span><strong>Submission count</strong> - number of answers submitted</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span><strong>Average grade</strong> - their overall performance</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span><strong>Last active</strong> - most recent activity</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Individual Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Individual Student Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Click on a student to view their detailed progress:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li>All submissions with grades and feedback</li>
            <li>Questions answered vs. remaining</li>
            <li>Grade trends over time</li>
            <li>Time spent on the module</li>
            <li>Chatbot interaction history</li>
          </ul>
        </CardContent>
      </Card>

      {/* Activity Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            Activity Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Monitor student engagement with activity indicators:</p>
          <div className="space-y-3 mt-3">
            <div className="flex items-center gap-3">
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Active</Badge>
              <span className="text-sm">Engaged within the last 7 days</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">Idle</Badge>
              <span className="text-sm">No activity for 7-14 days</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Inactive</Badge>
              <span className="text-sm">No activity for more than 14 days</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Managing Students */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            Managing Students
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Actions you can take:</p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <Eye className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
              <span><strong>View details</strong> - See full student profile and progress</span>
            </li>
            <li className="flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-500 mt-1 flex-shrink-0" />
              <span><strong>Remove</strong> - Remove a student from the module</span>
            </li>
          </ul>
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <strong>Note:</strong> Removing a student will revoke their access but preserve their submission history for your records.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
