'use client';

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Copy, RotateCcw, ExternalLink, Check, Trash2, Settings, FileText, Plus, Loader2, Sparkles, Rocket } from "lucide-react";
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
      mode: 'ai_visible',
      per_attempt_enabled: false,
      attempt_modes: {},
    },
    features: {
      multiple_attempts: { enabled: true, max_attempts: 2, show_feedback_after_each: true },
      chatbot_feedback:  { enabled: true, conversation_mode: 'guided', ai_model: 'gpt-4' },
      mastery_learning:  { enabled: true, streak_required: 3, queue_randomization: true, reset_on_wrong: false },
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

      // Derive ai_grading_mode from grading config
      const gradingModeMap = {
        ai_visible:      'visible',
        ai_teacher_only: 'teacher_only',
        manual:          'disabled',
      };
      const gradingMode = formData.assignment_config?.grading?.mode || 'ai_visible';
      const ai_grading_mode = gradingModeMap[gradingMode] || 'visible';

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
          await apiClient.post(
            `/api/modules/${createdModule.id}/rubric/apply-template`,
            null,
            { params: { template_name: formData.rubric_template, preserve_custom_instructions: false } }
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-800/30 to-gray-900/30 dark:from-gray-950 dark:via-gray-800/10 dark:to-gray-900/10 flex items-center justify-center">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-800/30 to-gray-900/30 dark:from-gray-950 dark:via-gray-800/10 dark:to-gray-900/10">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Premium Header */}
        <div className="mb-10 relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 opacity-95"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjIiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30"></div>
          <div className="relative p-8 md:p-12 text-white">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Badge className="bg-white/30 backdrop-blur-sm border-white/40 text-white font-bold text-sm px-4 py-1.5">
                    ⭐ MOST IMPORTANT PAGE
                  </Badge>
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight drop-shadow-lg">
                  Module Management
                </h1>
                <p className="text-lg text-white/90">
                  Create and manage your educational modules - your central hub for course management
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-4xl font-bold">{modules.length}</div>
                  <div className="text-sm text-white/80">Total Modules</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Module Form - Left Side */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-2xl sticky top-6">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-900"></div>
                <Card className="shadow-2xl border-2 border-indigo-100 dark:border-indigo-900">
                  <CardHeader className="pb-4 bg-gray-900 dark:from-gray-800/30 dark:to-gray-900/30">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-lg">
                        <Plus className="w-5 h-5 text-white" />
                      </div>
                      <CardTitle className="text-xl font-bold">Create New Module</CardTitle>
                    </div>
                    <p className="text-sm text-muted-foreground">Configure your module settings</p>
                  </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-5">
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
                      <p className="text-xs text-muted-foreground">Use hyphens or underscores instead of spaces or slashes</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        placeholder="Brief description of this module..."
                        rows={3}
                        className="resize-none"
                      />
                    </div>

                    {/* Rubric Template Selector */}
                    <div className="pt-4 border-t space-y-2">
                      <RubricQuickSelector
                        value={formData.rubric_template}
                        onChange={(template) => setFormData({...formData, rubric_template: template})}
                      />
                    </div>

                    {/* Assignment Features Section */}
                    <div className="space-y-3 pt-4 border-t">
                      <div>
                        <Label className="text-sm font-medium">Assignment Features</Label>
                        <p className="text-xs text-muted-foreground mt-1">Configure student interaction settings</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="text-xs text-muted-foreground">Active:</span>
                          {(() => {
                            const gm = formData.assignment_config?.grading?.mode;
                            const label = gm === 'ai_visible' ? 'AI Grading' : gm === 'ai_teacher_only' ? 'AI (Teacher Only)' : 'Manual Grading';
                            return <Badge variant="secondary" className="text-xs">{label}</Badge>;
                          })()}
                          {formData.assignment_config.features.multiple_attempts.enabled && (
                            <Badge variant="secondary" className="text-xs">Multiple Attempts</Badge>
                          )}
                          {formData.assignment_config.features.chatbot_feedback.enabled && (
                            <Badge variant="secondary" className="text-xs">AI Chatbot</Badge>
                          )}
                          {formData.assignment_config.features.mastery_learning.enabled && (
                            <Badge variant="secondary" className="text-xs">Mastery Learning</Badge>
                          )}
                        </div>
                      </div>
                      <AssignmentFeaturesSelector
                        value={formData.assignment_config}
                        onChange={(config) => setFormData({...formData, assignment_config: config})}
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-12 text-base font-bold bg-gray-900 hover:from-gray-800 hover:to-gray-900 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 mt-6"
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {modules.map((module) => (
                  <Card key={module.id} className="group hover:shadow-md transition-all duration-200 border bg-card">
                    <CardContent className="p-6">
                      <div className="space-y-5">
                        {/* Header */}
                        <div className="border-b border-border pb-4">
                          <h3 className="font-semibold text-lg text-foreground mb-2">{module.name}</h3>
                          {module.description && (
                            <p className="text-muted-foreground text-sm leading-relaxed">{module.description}</p>
                          )}
                        </div>

                        {/* Access Code Section */}
                        <div className="space-y-3">
                          <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">Student Access Code</Label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted/50 px-4 py-3 rounded-lg border border-border">
                              <span className="font-mono text-lg font-bold text-foreground tracking-wider">
                                {module.access_code}
                              </span>
                            </div>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(module.access_code, 'code', module.id)}
                                className="h-10 w-10 p-0 hover:bg-muted"
                                title="Copy access code"
                              >
                                {copiedItems[`${module.id}-code`] ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setModuleToRegenerate(module.id);
                                  setShowRegenerateDialog(true);
                                }}
                                className="h-10 w-10 p-0 hover:bg-muted"
                                title="Regenerate access code"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Join URL Section */}
                        <div className="space-y-3">
                          <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">Enrollment URL</Label>
                          <div className="relative">
                            <div className="bg-muted/30 p-3.5 rounded-lg border border-border">
                              <p className="text-xs text-foreground/70 font-mono break-all leading-relaxed">
                                {generateModuleUrl(module)}
                              </p>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(generateModuleUrl(module), 'url', module.id)}
                                className="flex-1 h-9 hover:bg-muted"
                              >
                                {copiedItems[`${module.id}-url`] ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 mr-2 text-green-600" />
                                    <span className="text-sm font-medium">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 mr-2" />
                                    <span className="text-sm font-medium">Copy URL</span>
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(generateModuleUrl(module), '_blank')}
                                className="h-9 px-4 hover:bg-muted"
                                title="Open in new tab"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-4 border-t border-border">
                          <div className="space-y-2">
                            <Button asChild size="lg" className="w-full bg-primary hover:bg-primary/90 font-medium shadow-sm">
                              <Link href={`/dashboard?module=${encodeURIComponent(module.name)}`}>
                                Manage Module
                              </Link>
                            </Button>
                            <div className="grid grid-cols-3 gap-2">
                              <Button
                                asChild
                                variant="outline"
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
                                variant="outline"
                                size="sm"
                                className="w-full h-9 text-xs hover:bg-muted"
                              >
                                <Link href={`/module/${module.id}/consent`}>
                                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                                  Consent
                                </Link>
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteModule(module.id, module.name)}
                                disabled={deletingModules[module.id]}
                                className="w-full h-9 text-xs"
                              >
                                {deletingModules[module.id] ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white mr-1.5"></div>
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