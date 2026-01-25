'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Rocket,
  UserPlus,
  Mail,
  LogIn,
  KeyRound,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export default function GettingStartedPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Getting Started</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Create your account, verify your email, and start building your first module.</p>
      </div>

      {/* Sign Up */}
      <Card className="border-2 border-emerald-200 dark:border-emerald-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <UserPlus className="w-5 h-5" />
            Creating Your Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>To get started with AI Education Pilot:</p>
          <ol className="space-y-3 list-decimal list-inside">
            <li>Navigate to the <strong>Sign Up</strong> page</li>
            <li>Enter your full name, email address, and a secure password</li>
            <li>Select <Badge variant="outline" className="mx-1">Teacher</Badge> as your role</li>
            <li>Click <strong>&quot;Create Account&quot;</strong></li>
          </ol>
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <strong className="text-amber-800 dark:text-amber-300">Important:</strong>
                <span className="text-amber-700 dark:text-amber-400"> Use a valid email address as you&apos;ll need to verify it before accessing the platform.</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Email Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>After signing up, you&apos;ll receive a verification email:</p>
          <ol className="space-y-2 list-decimal list-inside">
            <li>Check your inbox for an email from AI Education Pilot</li>
            <li>Click the verification link in the email</li>
            <li>You&apos;ll be redirected to the login page with a success message</li>
          </ol>
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Didn&apos;t receive the email? Check your spam folder or request a new verification email from the login page.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Logging In */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogIn className="w-5 h-5 text-purple-600" />
            Logging In
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Once your email is verified:</p>
          <ol className="space-y-2 list-decimal list-inside">
            <li>Go to the <strong>Sign In</strong> page</li>
            <li>Enter your registered email and password</li>
            <li>Click <strong>&quot;Sign In&quot;</strong></li>
            <li>You&apos;ll be redirected to your dashboard</li>
          </ol>
        </CardContent>
      </Card>

      {/* Password Reset */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-orange-600" />
            Password Reset
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>If you forget your password:</p>
          <ol className="space-y-2 list-decimal list-inside">
            <li>Click <strong>&quot;Forgot Password?&quot;</strong> on the login page</li>
            <li>Enter your registered email address</li>
            <li>Check your email for a password reset link</li>
            <li>Click the link and enter your new password</li>
            <li>Log in with your new credentials</li>
          </ol>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card className="bg-gradient-to-br from-emerald-50/50 to-green-50/30 dark:from-emerald-950/20 dark:to-green-950/10">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Next Steps</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Once you&apos;re logged in, head to the <strong>Dashboard</strong> section to learn about navigating the platform and creating your first module.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
