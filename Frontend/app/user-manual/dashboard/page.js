'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LayoutDashboard,
  BarChart3,
  Users,
  FileText,
  Plus,
  TrendingUp,
  PieChart,
  Activity,
} from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Your central hub for managing modules, viewing stats, and accessing all features.</p>
      </div>

      {/* Dashboard Layout */}
      <Card className="border-2 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <LayoutDashboard className="w-5 h-5" />
            Dashboard Layout
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>The dashboard is divided into several key areas:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {[
              { icon: BarChart3, title: 'Stats Overview', description: 'Total modules, students, submissions, and average grades at a glance', color: 'blue' },
              { icon: TrendingUp, title: 'Performance Charts', description: 'Visual graphs showing submission trends and grade distributions', color: 'green' },
              { icon: FileText, title: 'Module Cards', description: 'Quick-access cards for each of your modules with key metrics', color: 'purple' },
              { icon: Activity, title: 'Recent Activity', description: 'Latest submissions, feedback generation events, and student joins', color: 'orange' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <Icon className={`w-5 h-5 text-${item.color}-600 dark:text-${item.color}-400 flex-shrink-0 mt-0.5`} />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm">{item.title}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-indigo-600" />
            Statistics Cards
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>At the top of your dashboard, you&apos;ll see summary statistics:</p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
              <span><strong>Total Modules</strong> - Number of modules you&apos;ve created</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />
              <span><strong>Total Students</strong> - Combined students across all modules</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
              <span><strong>Total Submissions</strong> - All student submissions received</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
              <span><strong>Average Grade</strong> - Overall average across all graded work</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-600" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>From the dashboard you can quickly:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li>Create a new module using the <strong>&quot;Create Module&quot;</strong> button</li>
            <li>Click on any module card to enter and manage that module</li>
            <li>Use the sidebar navigation to access other features</li>
            <li>View and respond to recent activity notifications</li>
          </ul>
        </CardContent>
      </Card>

      {/* Navigation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            Sidebar Navigation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>The left sidebar provides access to all sections:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong>Dashboard</strong> - Return to the main overview</li>
            <li><strong>Documents</strong> - Manage uploaded course materials</li>
            <li><strong>Questions</strong> - View and manage generated questions</li>
            <li><strong>Rubric</strong> - Configure grading rubric and feedback settings</li>
            <li><strong>Students</strong> - View enrolled students and progress</li>
            <li><strong>Grading</strong> - Access the grading interface</li>
            <li><strong>Feedback</strong> - View AI-generated feedback status</li>
            <li><strong>Chatbot Settings</strong> - Configure the student chatbot</li>
            <li><strong>Analytics</strong> - View detailed performance metrics</li>
            <li><strong>Settings</strong> - Module and account settings</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
