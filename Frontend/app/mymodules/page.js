'use client';

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Copy, RotateCcw, ExternalLink, Check, Trash2, Settings, FileText, Plus, Loader2, Rocket, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/auth";
import AssignmentFeaturesSelector from "@/components/AssignmentFeaturesSelector";
import RubricQuickSelector from "@/components/rubric/RubricQuickSelector";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function MyModules() {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [modules, setModules] = useState([]);
  const [fetchingModules, setFetchingModules] = useState(false);
  const [mounted, setMounted] = useState(false);
  const defaultAssignmentConfig = {
    grading: {
      mode: 'auto',
      per_attempt_enabled: false,
      attempt_modes: {},
    },
    features: {
      multiple_attempts: { enabled: true, max_attempts: 2, show_feedback_after_each: true },
      chatbot_feedback:  { enabled: true, conversation_mode: 'guided', ai_model: 'gpt-4' },
      mastery_learning:  { enabled: false, streak_required: 3, queue_randomization: true, reset_on_wrong: false },
    },
    display_settings: {
      show_progress_bar: true,
      show_streak_counter: true,
      show_attempt_counter: true,
    },
  };

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    rubric_template: 'default',
    assignment_config: defaultAssignmentConfig,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedItems, setCopiedItems] = useState({});
  const [deletingModules, setDeletingModules] = useState({});
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [moduleToRegenerate, setModuleToRegenerate] = useState(null);

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect students away from the teacher view
  useEffect(() => {
    if (!loading && isAuthenticated && user && user.role === 'student') {
      router.replace('/student-dashboard');
    }
  }, [loading, isAuthenticated, user, router]);

  const fetchModules = async () => {
    try {
      // Ensure user and user.id are available
      const userId = user?.id || user?.sub;
      if (!userId) {
        console.warn('⚠️ fetchModules: User ID not available yet', { user, isAuthenticated });
        return;
      }

      setFetchingModules(true);
      console.log('📚 Fetching modules for user:', userId);
      const data = await apiClient.get(`/api/modules?teacher_id=${userId}`);
      setModules(data);
      console.log(`✅ Loaded ${data?.length || 0} modules`);
    } catch (error) {
      console.error('❌ Failed to fetch modules:', error);
    } finally {
      setFetchingModules(false);
    }
  };

  useEffect(() => {
    if (!mounted) return;

    console.log('🔍 MyModules useEffect:', {
      isAuthenticated,
      hasUser: !!user,
      userId: user?.id || user?.sub,
      userObject: user
    });

    if (isAuthenticated && user) {
      const userId = user.id || user.sub;
      if (userId) {
        console.log('✅ User ID found, fetching modules for:', userId);
        fetchModules();
      } else {
        console.log('⚠️ User object exists but no ID found:', user);
      }
    } else if (!loading) {
      console.log('⏳ Waiting for auth to complete...', { isAuthenticated, user, loading });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isAuthenticated, user, loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      // Ensure user ID is available
      const userId = user?.id || user?.sub;
      if (!userId) {
        throw new Error('User ID not available. Please try logging in again.');
      }

      const ai_grading_mode = formData.assignment_config?.grading?.mode || 'auto';

      // Create module first
      const moduleData = {
        teacher_id: userId,
        name: formData.name,
        description: formData.description,
        is_active: true,
        visibility: 'class-only',
        ai_grading_mode,
        assignment_config: formData.assignment_config,
      };

      const createdModule = await apiClient.post('/api/modules', moduleData);

      // Apply rubric template if not default
      if (formData.rubric_template && formData.rubric_template !== 'default') {
        try {
          const templateParams = new URLSearchParams({
            template_name: formData.rubric_template,
            preserve_custom_instructions: 'false',
          });
          await apiClient.post(
            `/api/modules/${createdModule.id}/rubric/apply-template?${templateParams}`,
            null
          );
        } catch (error) {
          console.error('Failed to apply rubric template:', error);
        }
      }

      setFormData({ name: '', description: '', rubric_template: 'default', assignment_config: defaultAssignmentConfig });
      fetchModules(); // Refresh the list
    } catch (error) {
      console.error('Failed to create module:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateModuleUrl = (module) => {
    return `${window.location.origin}/${module.teacher_id}/${module.name}`;
  };

  const copyToClipboard = async (text, type, moduleId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems({...copiedItems, [`${moduleId}-${type}`]: true});
      setTimeout(() => {
        setCopiedItems(prev => ({...prev, [`${moduleId}-${type}`]: false}));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const regenerateAccessCode = async () => {
    if (!moduleToRegenerate) return;

    try {
      await apiClient.post(`/api/modules/${moduleToRegenerate}/regenerate-code`);
      fetchModules(); // Refresh to get new access code
      setShowRegenerateDialog(false);
      setModuleToRegenerate(null);
    } catch (error) {
      console.error('Failed to regenerate access code:', error);
      setShowRegenerateDialog(false);
      setModuleToRegenerate(null);
    }
  };

  const deleteModule = async (moduleId, moduleName) => {
    const confirmMessage = `Are you sure you want to delete "${moduleName}"?\n\n⚠️ WARNING: This will permanently delete:\n• All questions in this module\n• All student answers and progress\n• All uploaded documents\n• All student enrollments\n\nThis action cannot be undone!`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setDeletingModules(prev => ({ ...prev, [moduleId]: true }));

    try {
      await apiClient.delete(`/api/modules/${moduleId}`);
      fetchModules(); // Refresh the list

      // Show success message
      alert(`Module "${moduleName}" has been successfully deleted.`);
    } catch (error) {
      console.error('Failed to delete module:', error);
      alert(`Failed to delete module "${moduleName}". Please try again.`);
    } finally {
      setDeletingModules(prev => ({ ...prev, [moduleId]: false }));
    }
  };

  if (!mounted) return null;

  // Show loading while auth is initializing OR user data not yet available
  if (loading || (isAuthenticated && !user)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="large" text="Loading modules..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl mb-4">Access Denied</h1>
        <Button asChild>
          <Link href="/sign-in">Sign In</Link>
        </Button>
      </div>
    );
  }

  if (user && user.role === 'student') return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Teaching workspace</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">My Modules</h1>
            <p className="mt-2 text-sm text-muted-foreground">Create modules, share access with students, and manage learning.</p>
          </div>
          <div className="self-start sm:self-center rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{modules.length}</span> {modules.length === 1 ? 'module' : 'modules'}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Module Form - Left Side */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-2xl sticky top-6">

                <Card className="shadow-sm border border-border bg-card">
                  <CardHeader className="px-5 pt-5 pb-0">
                    <CardTitle className="text-lg font-semibold tracking-tight">New module</CardTitle>
                    <p className="text-xs text-muted-foreground">Start with a name. Customize as you go.</p>
                  </CardHeader>
                <CardContent className="px-5 pb-5">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium">Module Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[\s\/]/g, '');
                          setFormData({...formData, name: value});
                        }}
                        placeholder="e.g., intro-to-programming"
                        required
                        pattern="[^\s\/]+"
                        title="Module name cannot contain spaces or forward slashes"
                        className="h-10"
                      />
                      <p className="text-xs text-muted-foreground">Use hyphens between words.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-sm font-medium">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        placeholder="Brief description of this module..."
                        rows={2}
                        className="resize-none"
                      />
                    </div>

                    <div className="divide-y divide-border rounded-xl border border-border bg-muted/20">
                      <details className="group/feedback">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-xl">
                          <span>Feedback style</span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open/feedback:rotate-180" />
                        </summary>
                        <div className="px-4 pb-4">
                          <RubricQuickSelector
                            value={formData.rubric_template}
                            onChange={(template) => setFormData({...formData, rubric_template: template})}
                          />
                        </div>
                      </details>
                      <details className="group/features">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-xl">
                          <span>Assignment options</span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open/features:rotate-180" />
                        </summary>
                        <div className="px-3 pb-3">
                          <AssignmentFeaturesSelector
                            value={formData.assignment_config}
                            onChange={(config) => setFormData({...formData, assignment_config: config})}
                          />
                        </div>
                      </details>
                    </div>

                    <p className="text-xs text-muted-foreground">Includes 5 default student survey questions. Edit them in module settings after creation.</p>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-11 rounded-xl text-sm font-semibold"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Creating Module...
                        </>
                      ) : (
                        <>
                          <Plus className="w-5 h-5 mr-2" />
                          Create Module
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
          </div>

          {/* Modules Grid - Right Side */}
          <div className="lg:col-span-2">
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-2">Your Modules</h2>
              <p className="text-sm text-muted-foreground">View and manage all your created modules</p>
            </div>

            {fetchingModules && modules.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <LoadingSpinner size="large" text="Loading your modules..." />
              </div>
            ) : modules.length === 0 ? (
              <Card className="border-dashed border-2 max-w-md mx-auto">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No modules created yet</h3>
                  <p className="text-sm text-muted-foreground">Get started by creating your first module using the form on the left.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modules.map((module) => (
                  <Card key={module.id} className="group rounded-2xl border border-border bg-card shadow-none hover:border-primary/20 hover:shadow-sm transition-[border-color,box-shadow] duration-200">
                    <CardContent className="p-5">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="min-w-0">
                          <h3 className="font-semibold text-base text-foreground mb-1 break-words">{module.name}</h3>
                          {module.description && (
                            <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">{module.description}</p>
                          )}
                        </div>

                        {/* Access Code Section */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground">Student access</Label>
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1 bg-muted/50 px-3 py-2 rounded-lg">
                              <span className="font-mono text-base font-semibold text-foreground tracking-wide break-all">
                                {module.access_code}
                              </span>
                            </div>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(module.access_code, 'code', module.id)}
                                className="h-9 w-9 p-0 hover:bg-muted"
                                title="Copy access code" aria-label="Copy access code"
                              >
                                {copiedItems[`${module.id}-code`] ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setModuleToRegenerate(module.id);
                                  setShowRegenerateDialog(true);
                                }}
                                className="h-9 w-9 p-0 hover:bg-muted"
                                title="Regenerate access code" aria-label="Regenerate access code"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Join URL Section */}
                        <div className="space-y-2">
                          <div className="relative">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(generateModuleUrl(module), 'url', module.id)}
                                className="flex-1 h-9 justify-start px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                              >
                                {copiedItems[`${module.id}-url`] ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 mr-2 text-green-600" />
                                    <span className="text-sm font-medium">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 mr-2" />
                                    <span className="text-sm font-medium">Copy invite link</span>
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(generateModuleUrl(module), '_blank')}
                                className="h-9 w-9 p-0 text-muted-foreground hover:bg-muted"
                                title="Open student enrollment page" aria-label="Open student enrollment page"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-4 border-t border-border">
                          <div className="space-y-2">
                            <Button asChild size="lg" className="w-full h-10 rounded-lg bg-primary hover:bg-primary/90 text-sm font-medium shadow-none">
                              <Link href={`/dashboard?module=${encodeURIComponent(module.name)}`}>
                                Manage Module
                              </Link>
                            </Button>
                            <div className="grid grid-cols-3 gap-2">
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="w-full h-9 text-xs hover:bg-muted"
                              >
                                <Link href={`/dashboard/rubric?module=${encodeURIComponent(module.name)}`}>
                                  <Settings className="w-3.5 h-3.5 mr-1.5" />
                                  Rubric
                                </Link>
                              </Button>
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="w-full h-9 text-xs hover:bg-muted"
                              >
                                <Link href={`/module/${module.id}/consent`}>
                                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                                  Consent
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteModule(module.id, module.name)}
                                disabled={deletingModules[module.id]}
                                className="w-full h-9 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                              >
                                {deletingModules[module.id] ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current mr-1.5"></div>
                                    <span className="text-xs">Deleting</span>
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                    Delete
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Regenerating Access Code */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold">Regenerate Access Code</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-foreground/80">
                  Are you sure you want to regenerate the access code for this module?
                </p>
                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg p-4">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="space-y-2">
                      <p className="font-semibold text-sm text-orange-900 dark:text-orange-100">Warning</p>
                      <p className="text-sm text-orange-800 dark:text-orange-200">
                        The current access code will immediately become invalid. Students with the old code will no longer be able to access the module. You will need to share the new code with all students.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="h-10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={regenerateAccessCode}
              className="bg-orange-600 hover:bg-orange-700 focus:ring-orange-600 h-10"
            >
              Regenerate Code
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}