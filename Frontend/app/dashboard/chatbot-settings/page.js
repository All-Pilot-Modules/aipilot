'use client';

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Save, RotateCcw, AlertCircle, CheckCircle2, Sparkles, ArrowLeft } from "lucide-react";
import { apiClient } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { CardSkeleton, Skeleton } from "@/components/SkeletonLoader";

function ChatbotSettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const moduleName = searchParams.get('module'); // Get module name from query param
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moduleId, setModuleId] = useState(null);
  const [moduleData, setModuleData] = useState(null);
  const [instructions, setInstructions] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [error, setError] = useState("");

  // Fetch module by name to get moduleId
  useEffect(() => {
    const fetchModule = async () => {
      if (!moduleName) {
        setError("No module specified. Please select a module from the sidebar.");
        setLoading(false);
        return;
      }

      if (!user) {
        // User not loaded yet, keep waiting
        return;
      }

      try {
        const userId = user.id || user.sub;
        if (!userId) {
          setError("User ID not available");
          setLoading(false);
          return;
        }

        const response = await apiClient.get(`/api/modules?teacher_id=${userId}`);
        const modules = response?.data || response || [];
        const foundModule = modules.find(m => m.name === moduleName);
        if (foundModule) {
          setModuleId(foundModule.id);
        } else {
          setError("Module not found");
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch module:', error);
        setError("Failed to fetch module");
        setLoading(false);
      }
    };

    fetchModule();
  }, [moduleName, user]);

  const loadChatbotSettings = useCallback(async () => {
    if (!moduleId) return;

    try {
      setLoading(true);
      setError("");

      const response = await apiClient.get(`/api/modules/${moduleId}/chatbot-instructions`);

      setModuleData(response);
      setInstructions(response.chatbot_instructions);
      setIsCustom(response.is_custom);
    } catch (error) {
      console.error('Failed to load chatbot settings:', error);
      setError(error.message || "Failed to load chatbot settings");
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    if (moduleId) {
      loadChatbotSettings();
    }
  }, [moduleId, loadChatbotSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSavedMessage("");

      await apiClient.put(`/api/modules/${moduleId}/chatbot-instructions`, {
        instructions: instructions
      });

      setSavedMessage("Chatbot instructions saved successfully!");
      setIsCustom(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSavedMessage(""), 3000);
    } catch (error) {
      console.error('Failed to save instructions:', error);
      setError(error.message || "Failed to save instructions");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset to default instructions?")) {
      loadChatbotSettings();
    }
  };

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-800/30 to-gray-900/20 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
            <div className="max-w-5xl mx-auto px-6 py-8">
              {/* Breadcrumb Skeleton */}
              <div className="mb-6">
                <Skeleton className="h-4 w-48 mb-3" />
                <Skeleton className="h-10 w-32" />
              </div>

              {/* Header Skeleton */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-5 w-80" />
                  </div>
                </div>
              </div>

              {/* Content Skeleton */}
              <div className="space-y-6">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!moduleData) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center min-h-screen">
            <Card className="max-w-md">
              <CardContent className="p-6 text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Module Not Found</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Please select a module from the dashboard.
                </p>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  const chatCharCount = instructions.length;
  const maxChars = 5000;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-800/30 to-gray-900/20 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Breadcrumb Navigation */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
            <Link href="/dashboard" className="hover:text-gray-900 dark:hover:text-gray-100">
              Dashboard
            </Link>
            <span>/</span>
            {moduleName && (
              <>
                <Link
                  href={`/dashboard?module=${encodeURIComponent(moduleName)}`}
                  className="hover:text-gray-900 dark:hover:text-gray-100"
                >
                  {moduleName}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-gray-900 dark:text-gray-100">Chatbot Settings</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => moduleName ? router.push(`/dashboard?module=${encodeURIComponent(moduleName)}`) : router.back()}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Manage
          </Button>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                AI Chatbot Settings
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Customize how the AI tutor responds to students
              </p>
            </div>
          </div>
        </div>

        {/* Module Info */}
        <Card className="mb-6 border-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-1">{moduleData.module_name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Module ID: {moduleData.module_id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={moduleData.chatbot_enabled ? "default" : "secondary"}>
                  {moduleData.chatbot_enabled ? "Chatbot Enabled" : "Chatbot Disabled"}
                </Badge>
                {isCustom && (
                  <Badge variant="outline" className="bg-gray-50 dark:bg-gray-950">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Custom Instructions
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instructions Editor */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Chatbot Response Instructions</CardTitle>
            <CardDescription>
              Define how the AI chatbot should respond to student questions. These instructions will guide the chatbot&apos;s tone, style, and behavior.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  disabled={!moduleData.chatbot_enabled}
                  className="w-full h-96 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter custom instructions for the chatbot..."
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-gray-500">
                    {chatCharCount} / {maxChars} characters
                  </p>
                  {chatCharCount > maxChars && (
                    <p className="text-sm text-red-500 font-semibold">
                      Exceeds maximum length!
                    </p>
                  )}
                </div>
              </div>

              {!moduleData.chatbot_enabled && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                        Chatbot Disabled
                      </h4>
                      <p className="text-sm text-yellow-700 dark:text-yellow-400">
                        The chatbot is currently disabled for this module. Enable it in the module settings to allow students to use it.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {savedMessage && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500" />
                    <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                      {savedMessage}
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dark:text-red-400">
                      {error}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={!moduleData.chatbot_enabled || saving || chatCharCount > maxChars || !instructions.trim()}
                  className="bg-gray-900 hover:bg-gray-900"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Instructions
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  disabled={saving}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset to Default
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-gray-700" />
              Tips for Writing Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Response Style</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Define the tone (formal, casual, encouraging), complexity level, and whether to use technical jargon.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Teaching Philosophy</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Specify if the chatbot should give direct answers or guide students to discover answers themselves.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Content Boundaries</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Set guidelines on what topics the chatbot should or shouldn&apos;t discuss with students.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Example Format</h4>
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-sm font-mono mt-2">
                <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
You are a supportive AI tutor for an introductory biology course.

Response Style:
- Use simple, clear language
- Provide real-world examples
- Be encouraging and patient
- Ask follow-up questions to check understanding

When students ask questions:
1. First, ask them what they already know
2. Guide them to the answer rather than giving it directly
3. Reference specific course materials (slides, textbook pages)
4. Encourage them to try solving problems themselves

If a question is outside the course materials, politely redirect them to ask their instructor.
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function ChatbotSettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading chatbot settings...</p>
        </div>
      </div>
    }>
      <ChatbotSettingsContent />
    </Suspense>
  );
}
