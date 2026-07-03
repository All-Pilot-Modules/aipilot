'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle,
  ClipboardList,
  GripVertical,
  FileText,
  MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/auth';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { CardSkeleton, Skeleton } from '@/components/SkeletonLoader';

function SurveyEditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const moduleName = searchParams.get('module'); // Get module name from query param
  const { user } = useAuth();

  const [moduleId, setModuleId] = useState(null);
  const [module, setModule] = useState(null);
  const [surveyQuestions, setSurveyQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

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
          setModule(foundModule);
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

  const loadSurveyConfig = useCallback(async () => {
    if (!moduleId) return;

    try {
      setLoading(true);
      setError(null);

      // Load survey config
      const surveyConfig = await apiClient.get(`/api/modules/${moduleId}/survey`);
      setSurveyQuestions(surveyConfig.survey_questions || []);
    } catch (err) {
      console.error('Failed to load survey config:', err);
      setError('Failed to load survey configuration. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    if (moduleId) {
      loadSurveyConfig();
    }
  }, [moduleId, loadSurveyConfig]);

  const handleAddQuestion = () => {
    const newQuestion = {
      id: `q_${Date.now()}`,
      question: '',
      type: 'long',
      required: false,
      placeholder: ''
    };
    setSurveyQuestions([...surveyQuestions, newQuestion]);
  };

  const handleRemoveQuestion = (index) => {
    const updated = surveyQuestions.filter((_, i) => i !== index);
    setSurveyQuestions(updated);
  };

  const handleQuestionChange = (index, field, value) => {
    const updated = [...surveyQuestions];
    updated[index][field] = value;
    setSurveyQuestions(updated);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Validate questions
      for (const question of surveyQuestions) {
        if (!question.question.trim()) {
          setError('All questions must have text. Please fill in or remove empty questions.');
          setSaving(false);
          return;
        }
      }

      // Save survey config
      await apiClient.put(`/api/modules/${moduleId}/survey`, {
        survey_questions: surveyQuestions
      });

      setSuccess(true);

      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save survey config:', err);
      setError(err.message || 'Failed to save survey configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-800/20 to-slate-100 dark:from-slate-950 dark:via-gray-800/10 dark:to-slate-900">
            <div className="max-w-5xl mx-auto px-6 py-12">
              {/* Header Skeleton */}
              <div className="mb-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-20 h-20 rounded-2xl" />
                      <div className="space-y-2">
                        <Skeleton className="h-10 w-96" />
                        <Skeleton className="h-6 w-48" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-full max-w-3xl" />
                  </div>
                  <Skeleton className="h-12 w-40" />
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

  if (!module) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="min-h-screen bg-background flex items-center justify-center">
            <Card className="max-w-md">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-red-600 mb-4">{error || 'Module not found'}</p>
                  <Button asChild>
                    <Link href="/mymodules">Back to Modules</Link>
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-800/20 to-slate-100 dark:from-slate-950 dark:via-gray-800/10 dark:to-slate-900">
          <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Premium Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gray-900 rounded-2xl blur-xl opacity-25"></div>
                  <div className="relative p-4 rounded-2xl bg-gray-900 shadow-xl">
                    <ClipboardList className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-black bg-gradient-to-r from-slate-900 via-gray-800 to-gray-900 dark:from-slate-100 dark:via-gray-800 dark:to-gray-900 bg-clip-text text-transparent">
                    Survey Configuration
                  </h1>
                  <Badge className="mt-2 bg-gray-900 text-white border-0 shadow-md">
                    📚 Module: {module.name}
                  </Badge>
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-base max-w-3xl leading-relaxed">
                Create custom survey questions to gather feedback and insights from your students
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={saving}
                size="lg"
                className="shadow-xl hover:shadow-2xl transition-all bg-gray-900 hover:from-gray-800 hover:to-gray-900 border-0 px-8 font-semibold"
              >
                {saving ? (
                  <>
                    <Save className="w-5 h-5 mr-2 animate-pulse" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {success && (
          <div className="animate-in slide-in-from-top-4 duration-500 mb-6">
            <Card className="border-2 border-green-400 dark:border-green-600 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 shadow-lg">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-green-500 dark:bg-green-600 shadow-lg">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-green-900 dark:text-green-100 text-base">Success!</p>
                    <p className="text-sm text-green-800 dark:text-green-200">Survey configuration saved successfully</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="animate-in slide-in-from-top-4 duration-500 mb-6">
            <Card className="border-2 border-red-400 dark:border-red-600 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/20 shadow-lg">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-red-500 dark:bg-red-600 shadow-lg">
                    <AlertCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-red-900 dark:text-red-100 text-base">Error</p>
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Survey Questions */}
        <Card className="border-2 border-gray-200 dark:border-blue-800 bg-gradient-to-br from-gray-800/30 to-cyan-50/20 dark:from-gray-800/20 dark:to-cyan-950/10 shadow-lg">
          <CardHeader className="border-b-2 border-gray-200 dark:border-blue-700 bg-gradient-to-r from-gray-800/50 to-cyan-100/50 dark:from-gray-800/40 dark:to-cyan-900/30">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-gray-800 to-cyan-600 shadow-lg">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-blue-900 dark:text-blue-100">
                    Survey Questions
                  </CardTitle>
                  <CardDescription className="text-blue-800 dark:text-gray-400 mt-1">
                    Add and customize survey questions for student feedback
                  </CardDescription>
                </div>
              </div>
              <Button
                onClick={handleAddQuestion}
                size="lg"
                className="bg-gradient-to-r from-gray-800 to-cyan-600 hover:from-gray-800 hover:to-cyan-700 text-white shadow-md hover:shadow-lg transition-all"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {surveyQuestions.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-300 dark:border-blue-700 rounded-xl bg-gradient-to-br from-gray-800/50 to-cyan-50/30 dark:from-gray-800/10 dark:to-cyan-950/10">
                  <div className="mb-4 p-4 rounded-full bg-gray-100 dark:bg-gray-900/30 w-20 h-20 flex items-center justify-center mx-auto">
                    <ClipboardList className="w-10 h-10 text-gray-700 dark:text-gray-500" />
                  </div>
                  <p className="text-blue-900 dark:text-blue-100 font-semibold mb-2 text-lg">No survey questions yet</p>
                  <p className="text-gray-800 dark:text-gray-400 mb-6 text-sm">Create your first question to start gathering student feedback</p>
                  <Button
                    onClick={handleAddQuestion}
                    size="lg"
                    className="bg-gradient-to-r from-gray-800 to-cyan-600 hover:from-gray-800 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Your First Question
                  </Button>
                </div>
              ) : (
                surveyQuestions.map((question, index) => (
                  <Card
                    key={index}
                    className="border-2 border-slate-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-gray-300 transition-all duration-300 bg-white dark:bg-slate-900 shadow-md hover:shadow-xl"
                  >
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* Question Header */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-900/30 hover:bg-blue-200 dark:hover:bg-gray-900/50 cursor-move transition-colors">
                              <GripVertical className="w-5 h-5 text-gray-800 dark:text-gray-500" />
                            </div>
                            <Badge className="bg-gradient-to-r from-gray-800 to-cyan-600 text-white border-0 px-3 py-1.5 shadow-md text-sm">
                              Question {index + 1}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveQuestion(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>

                        {/* Question Text */}
                        <div>
                          <Label htmlFor={`question-${index}`} className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            Question Text *
                          </Label>
                          <Textarea
                            id={`question-${index}`}
                            value={question.question}
                            onChange={(e) => handleQuestionChange(index, 'question', e.target.value)}
                            placeholder="Enter your survey question..."
                            className="mt-2 border-2 border-slate-200 dark:border-slate-700 focus:border-gray-300 dark:focus:border-blue-600 transition-colors"
                            rows={3}
                          />
                        </div>

                        {/* Placeholder */}
                        <div>
                          <Label htmlFor={`placeholder-${index}`} className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            Placeholder Text (Optional)
                          </Label>
                          <Input
                            id={`placeholder-${index}`}
                            value={question.placeholder || ''}
                            onChange={(e) => handleQuestionChange(index, 'placeholder', e.target.value)}
                            placeholder="Hint text for students..."
                            className="mt-2 border-2 border-slate-200 dark:border-slate-700 focus:border-gray-300 dark:focus:border-blue-600 transition-colors"
                          />
                        </div>

                        {/* Question Type & Required */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 rounded-lg bg-gradient-to-br from-slate-50 to-gray-900 dark:from-slate-800/50 dark:to-gray-900/20 border-2 border-slate-200 dark:border-slate-700">
                            <Label htmlFor={`type-${index}`} className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              Answer Type
                            </Label>
                            <select
                              id={`type-${index}`}
                              value={question.type}
                              onChange={(e) => handleQuestionChange(index, 'type', e.target.value)}
                              className="w-full mt-2 px-3 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 font-medium focus:border-gray-300 dark:focus:border-blue-600 transition-colors"
                            >
                              <option value="short">📝 Short Answer (1 line)</option>
                              <option value="long">📄 Long Answer (Multi-line)</option>
                            </select>
                          </div>

                          <div className="p-4 rounded-lg bg-gradient-to-br from-slate-50 to-gray-900 dark:from-slate-800/50 dark:to-gray-900/20 border-2 border-slate-200 dark:border-slate-700">
                            <Label className="text-sm font-bold text-slate-900 dark:text-slate-100 block mb-3">
                              Options
                            </Label>
                            <div className="flex items-center space-x-3">
                              <Switch
                                id={`required-${index}`}
                                checked={question.required}
                                onCheckedChange={(checked) => handleQuestionChange(index, 'required', checked)}
                                className="scale-110"
                              />
                              <Label htmlFor={`required-${index}`} className="text-sm font-medium cursor-pointer">
                                Required Question
                              </Label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Save Button */}
        {surveyQuestions.length > 0 && (
          <div className="mt-8 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              size="lg"
              className="shadow-xl hover:shadow-2xl transition-all bg-gray-900 hover:from-gray-800 hover:to-gray-900 border-0 px-10 py-6 font-bold text-base"
            >
              {saving ? (
                <>
                  <Save className="w-5 h-5 mr-2 animate-pulse" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save Survey Configuration
                </>
              )}
            </Button>
          </div>
        )}

        {/* Student Preview Section */}
        {surveyQuestions.length > 0 && (
          <Card className="mt-12 border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/30 to-teal-50/20 dark:from-emerald-950/20 dark:to-teal-950/10 shadow-lg">
            <CardHeader className="border-b-2 border-emerald-200 dark:border-emerald-700 bg-gradient-to-r from-emerald-100/50 to-teal-100/50 dark:from-emerald-900/40 dark:to-teal-900/30">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 shadow-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
                    Student View Preview
                  </CardTitle>
                  <CardDescription className="text-emerald-800 dark:text-emerald-300 mt-1">
                    This is how students will see the survey form
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-8 pb-8">
              {/* Preview Container */}
              <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8">
                {/* Survey Header */}
                <div className="mb-8 pb-6 border-b-2 border-slate-200 dark:border-slate-700">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Student Feedback Survey
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400">
                    Please take a moment to share your thoughts and feedback
                  </p>
                </div>

                {/* Survey Questions */}
                <div className="space-y-6">
                  {surveyQuestions.map((question, index) => (
                    <div key={index} className="space-y-3">
                      <Label className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-900 text-white text-sm font-bold">
                          {index + 1}
                        </span>
                        {question.question}
                        {question.required && (
                          <span className="text-red-500 text-lg">*</span>
                        )}
                      </Label>
                      {question.type === 'short' ? (
                        <Input
                          placeholder={question.placeholder || 'Your answer...'}
                          disabled
                          className="border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
                        />
                      ) : (
                        <Textarea
                          placeholder={question.placeholder || 'Your answer...'}
                          disabled
                          rows={4}
                          className="border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
                        />
                      )}
                      {question.required && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          This field is required
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Submit Button Preview */}
                <div className="mt-8 pt-6 border-t-2 border-slate-200 dark:border-slate-700">
                  <Button
                    disabled
                    size="lg"
                    className="w-full bg-gray-900 text-white shadow-lg"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Submit Survey
                  </Button>
                </div>
              </div>

              {/* Preview Note */}
              <div className="mt-6 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  This is a preview only - form inputs are disabled
                </p>
              </div>
            </CardContent>
          </Card>
        )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function SurveyEditorPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SurveyEditorContent />
    </Suspense>
  );
}
