'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/auth';
import ConsentFormEditor from '@/components/ConsentFormEditor';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { CardSkeleton, Skeleton } from '@/components/SkeletonLoader';
import { useAuth } from '@/context/AuthContext';

export default function ModuleConsentPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const moduleIdOrName = params?.moduleId;

  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper to check if a string is a valid UUID or valid integer ID
  const isUUID = (str) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  const isValidId = (str) => {
    // Check if it's a UUID or a valid integer/string ID
    if (!str) return false;
    if (isUUID(str)) return true;
    // Check if it's a valid integer ID (as string or number)
    return /^\d+$/.test(String(str));
  };

  const loadModule = async () => {
    try {
      setLoading(true);

      let moduleData;

      // If moduleIdOrName is a UUID, fetch directly
      if (isUUID(moduleIdOrName)) {
        moduleData = await apiClient.get(`/api/modules/${moduleIdOrName}`);
      } else {
        // Otherwise, treat it as a module name and fetch by teacher
        if (!user?.id && !user?.sub) {
          setError('User not authenticated. Please log in.');
          setLoading(false);
          return;
        }

        const userId = user.id || user.sub;
        const response = await apiClient.get(`/api/modules?teacher_id=${userId}`);
        const modules = response?.data || response || [];

        const foundModule = modules.find(m => m.name === moduleIdOrName);

        if (!foundModule) {
          setError(`Module "${moduleIdOrName}" not found. Please check the module name.`);
          setLoading(false);
          return;
        }

        if (!foundModule.id) {
          console.error('Module found but has no ID:', foundModule);
          setError('Module data is invalid (missing ID).');
          setLoading(false);
          return;
        }

        moduleData = foundModule;
      }

      setModule(moduleData);

      // Add module name to URL for sidebar navigation
      if (moduleData?.name) {
        const url = new URL(window.location.href);
        if (!url.searchParams.get('module')) {
          url.searchParams.set('module', moduleData.name);
          window.history.replaceState({}, '', url);
        }
      }
    } catch (err) {
      console.error('Failed to load module:', err);

      let errorMessage = 'Failed to load module. Please try again.';
      if (err.response?.status === 404) {
        errorMessage = 'Module not found. It may have been deleted.';
      } else if (err.response?.status === 500) {
        errorMessage = 'Server error. Please try again in a few moments.';
      } else if (err.message === 'Network Error' || !err.response) {
        errorMessage = 'Network connection error. Please check your internet connection.';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (moduleIdOrName) {
      // If it's a UUID, we can load directly. If it's a name, we need user data first
      if (isUUID(moduleIdOrName)) {
        loadModule();
      } else if (user) {
        // Module name provided, user is loaded
        loadModule();
      } else {
        // Module name provided but user not loaded yet - keep waiting
        // Loading state will persist until user is loaded
      }
    } else {
      // No module ID or name provided
      setError('No module specified in URL.');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleIdOrName, user]);

  const handleUpdate = (updatedModule) => {
    // Merge the updated data with existing module to preserve the ID
    setModule(prevModule => ({
      ...prevModule,
      ...updatedModule,
      id: prevModule.id // Ensure ID is preserved
    }));
  };

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="min-h-screen bg-background">
            <div className="max-w-5xl mx-auto px-6 py-12">
              {/* Header Skeleton */}
              <div className="mb-8">
                <Skeleton className="h-10 w-32 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-9 w-96" />
                  <Skeleton className="h-5 w-64" />
                </div>
              </div>

              {/* Content Skeleton */}
              <div className="space-y-6">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  // Validate that module has a valid ID before rendering
  if (error || !module || !module.id || !isValidId(module.id)) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="min-h-screen bg-background flex items-center justify-center">
            <Card className="max-w-md">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-red-600 dark:text-red-300 mb-4">
                    {error || (!module ? 'Module not found' : 'Invalid module ID')}
                  </p>
                  <Button asChild>
                    <Link href="/mymodules">Back to My Modules</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="min-h-screen bg-background">
          <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href={`/dashboard?module=${module.name}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>

          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Consent Form Settings
            </h1>
            <p className="text-muted-foreground">
              Module: <span className="font-semibold">{module.name}</span>
            </p>
          </div>
        </div>

        {/* Consent Form Editor */}
        <ConsentFormEditor
          moduleId={module.id}
          initialConsentText={module.consent_form_text}
          initialConsentRequired={module.consent_required}
          onUpdate={handleUpdate}
        />

        {/* Info Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">How Consent Forms Work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              • When enabled, students will see this consent form immediately after joining your module
            </p>
            <p>
              • Students must select one of three options: Agree to research, Do not agree, or Not eligible
            </p>
            <p>
              • Their consent choice is recorded in the system and can be viewed in student analytics
            </p>
            <p>
              • You can disable consent requirements at any time by toggling the &quot;Require Consent&quot; switch
            </p>
            <p>
              • The consent form supports basic Markdown formatting for better readability
            </p>
          </CardContent>
        </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
