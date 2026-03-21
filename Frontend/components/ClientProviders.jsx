'use client';

import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import AuthHeader from "@/components/auth/AuthHeader";
import { SkipNav } from "@/components/SkipNav";

export function ClientProviders({ children }) {
  return (
    <>
      <SkipNav />
      <ErrorBoundary>
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            disableTransitionOnChange
          >
            <AuthHeader />
            {children}
          </ThemeProvider>
        </AuthProvider>
      </ErrorBoundary>
    </>
  );
}
