'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Users,
  Clock,
  Target,
  LineChart,
} from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">View detailed metrics, grade distributions, and student progress tracking.</p>
      </div>

      {/* Analytics Dashboard */}
      <Card className="border-2 border-amber-200 dark:border-amber-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <BarChart3 className="w-5 h-5" />
            Analytics Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>The Analytics section provides comprehensive insights into your module&apos;s performance:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li>Overall module statistics</li>
            <li>Visual charts and graphs</li>
            <li>Student performance comparisons</li>
            <li>Time-based trend analysis</li>
          </ul>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Key Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Track these important metrics:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {[
              { icon: Users, title: 'Total Students', description: 'Number of enrolled students', color: 'blue' },
              { icon: Target, title: 'Completion Rate', description: 'Percentage of questions answered', color: 'green' },
              { icon: TrendingUp, title: 'Average Score', description: 'Mean grade across all submissions', color: 'purple' },
              { icon: Clock, title: 'Avg. Response Time', description: 'Average time to complete questions', color: 'orange' },
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

      {/* Grade Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-600" />
            Grade Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>View how grades are distributed across your class:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong>Pie chart</strong> showing grade category breakdown (A, B, C, D, F)</li>
            <li><strong>Histogram</strong> showing score frequency distribution</li>
            <li><strong>Box plot</strong> showing median, quartiles, and outliers</li>
          </ul>
          <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              <strong>Tip:</strong> Use grade distributions to identify if questions are too easy or too difficult.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Progress Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="w-5 h-5 text-green-600" />
            Progress Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Monitor how students progress over time:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong>Submission timeline</strong> - When students are most active</li>
            <li><strong>Score trends</strong> - Are grades improving over time?</li>
            <li><strong>Completion progress</strong> - How many questions each student has answered</li>
            <li><strong>Engagement levels</strong> - Student activity patterns</li>
          </ul>
        </CardContent>
      </Card>

      {/* Question Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Question-Level Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Analyze performance on individual questions:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong>Difficulty analysis</strong> - Average score per question</li>
            <li><strong>Attempt rates</strong> - Which questions students attempt first/last</li>
            <li><strong>Common mistakes</strong> - Patterns in incorrect answers</li>
            <li><strong>Time per question</strong> - How long students spend on each</li>
          </ul>
        </CardContent>
      </Card>

      {/* Using Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-600" />
            Using Analytics Effectively
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Tips for leveraging analytics:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li>Identify struggling students early and provide support</li>
            <li>Adjust difficult questions based on class performance</li>
            <li>Recognize high-performers for additional challenges</li>
            <li>Optimize module content based on engagement data</li>
            <li>Track improvements after making changes</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
