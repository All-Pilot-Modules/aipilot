'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Wrench,
  HelpCircle,
  FileX,
  Bot,
  Users,
  RefreshCw,
  Mail,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

export default function TroubleshootingPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Troubleshooting</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Common issues and solutions for the AI Education Pilot platform.</p>
      </div>

      {/* Document Processing Issues */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileX className="w-5 h-5 text-red-600" />
            Document Processing Issues
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <div className="space-y-4">
            <div className="border-l-4 border-amber-400 pl-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Document stuck on &quot;Processing&quot;</h4>
              <p className="text-sm mt-1">If a document remains in processing for more than 10 minutes:</p>
              <ul className="text-sm list-disc list-inside mt-2 space-y-1">
                <li>Try deleting and re-uploading the document</li>
                <li>Ensure the file is not corrupted</li>
                <li>Check that the file size is within limits (usually 10MB)</li>
              </ul>
            </div>
            <div className="border-l-4 border-amber-400 pl-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Document processing failed</h4>
              <p className="text-sm mt-1">Common causes:</p>
              <ul className="text-sm list-disc list-inside mt-2 space-y-1">
                <li>Scanned PDFs without OCR text layer</li>
                <li>Password-protected files</li>
                <li>Corrupted file formats</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Grading Issues */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-600" />
            AI Grading Issues
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <div className="space-y-4">
            <div className="border-l-4 border-purple-400 pl-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Grades seem inaccurate</h4>
              <ul className="text-sm list-disc list-inside mt-2 space-y-1">
                <li>Review and update your rubric settings</li>
                <li>Add more specific custom instructions</li>
                <li>Ensure model answers are provided for complex questions</li>
                <li>You can always manually override grades</li>
              </ul>
            </div>
            <div className="border-l-4 border-purple-400 pl-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Feedback not generating</h4>
              <ul className="text-sm list-disc list-inside mt-2 space-y-1">
                <li>Check the feedback status in the Feedback section</li>
                <li>Try clicking &quot;Retry&quot; on failed feedback</li>
                <li>If issues persist, contact support</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student Access Issues */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-green-600" />
            Student Access Issues
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <div className="space-y-4">
            <div className="border-l-4 border-green-400 pl-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Student can&apos;t join with access code</h4>
              <ul className="text-sm list-disc list-inside mt-2 space-y-1">
                <li>Verify the code hasn&apos;t been regenerated</li>
                <li>Check for typos in the code</li>
                <li>Ensure the student is entering it at the correct URL</li>
              </ul>
            </div>
            <div className="border-l-4 border-green-400 pl-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Student not seeing questions</h4>
              <ul className="text-sm list-disc list-inside mt-2 space-y-1">
                <li>Verify questions are approved (not pending)</li>
                <li>Check if questions are set to visible</li>
                <li>Have the student refresh their page</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Issues */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Account Issues
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <div className="space-y-4">
            <div className="border-l-4 border-blue-400 pl-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Verification email not received</h4>
              <ul className="text-sm list-disc list-inside mt-2 space-y-1">
                <li>Check spam/junk folder</li>
                <li>Add our email domain to your whitelist</li>
                <li>Request a new verification email from the login page</li>
              </ul>
            </div>
            <div className="border-l-4 border-blue-400 pl-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Can&apos;t log in</h4>
              <ul className="text-sm list-disc list-inside mt-2 space-y-1">
                <li>Use the &quot;Forgot Password&quot; feature to reset</li>
                <li>Ensure your email is verified</li>
                <li>Clear browser cache and cookies</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* General Tips */}
      <Card className="border-2 border-emerald-200 dark:border-emerald-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle className="w-5 h-5" />
            General Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-500 mt-1 flex-shrink-0" />
              <span><strong>Refresh the page</strong> - Many issues resolve with a simple refresh</span>
            </li>
            <li className="flex items-start gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-500 mt-1 flex-shrink-0" />
              <span><strong>Clear cache</strong> - Try clearing browser cache if issues persist</span>
            </li>
            <li className="flex items-start gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-500 mt-1 flex-shrink-0" />
              <span><strong>Try another browser</strong> - Some issues are browser-specific</span>
            </li>
            <li className="flex items-start gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-500 mt-1 flex-shrink-0" />
              <span><strong>Check internet connection</strong> - Ensure stable connectivity</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Contact Support */}
      <Card className="bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Still need help?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                If you&apos;re experiencing an issue not covered here, please contact our support team. Include:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
                <li>A description of the problem</li>
                <li>Steps to reproduce the issue</li>
                <li>Screenshots if applicable</li>
                <li>Your browser and device information</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
