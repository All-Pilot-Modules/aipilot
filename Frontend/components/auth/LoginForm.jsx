'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle } from 'lucide-react';

export default function LoginForm() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const router = useRouter();

  // Prefetch the dashboard page when user starts typing for instant navigation
  useEffect(() => {
    if (identifier || password) {
      router.prefetch('/mymodules');
    }
  }, [identifier, password, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await login(identifier, password);

      // Use window.location for navigation to ensure full page reload
      // This ensures AuthContext reinitializes with the user data from sessionStorage
      window.location.href = '/mymodules';
    } catch (error) {
      console.error('Login error:', error);

      // Parse error message for better user experience
      let errorMessage = error.message;

      // Check if email verification is required
      if (errorMessage.includes('Email not verified') || errorMessage.includes('403')) {
        // Redirect to verification page
        router.push(`/verify-email?email=${encodeURIComponent(identifier)}`);
        return;
      } else if (errorMessage.includes('Incorrect credentials')) {
        errorMessage = 'Invalid email/username or password. Please check your credentials and try again.';
      } else if (errorMessage.includes('Inactive user')) {
        errorMessage = 'Your account has been deactivated. Please contact support for assistance.';
      } else if (errorMessage.includes('Unable to connect') || errorMessage.includes('fetch')) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
      } else if (errorMessage.includes('401')) {
        errorMessage = 'Invalid email/username or password. Please try again.';
      } else if (!errorMessage || errorMessage === 'Login failed') {
        errorMessage = 'Login failed. Please check your credentials and try again.';
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Email or Username</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="Enter your email or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>
            {error && (
              <div
                id="login-error"
                className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-3 rounded-lg"
                role="alert"
                aria-live="assertive"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Don't have an account?{' '}
              <Link href="/sign-up" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}