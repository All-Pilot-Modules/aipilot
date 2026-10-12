'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  ClipboardList,
  User,
  Calendar,
  MessageSquare,
  Download,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/auth';
import { LoadingSpinner } from '@/components/LoadingSpinner';

function SurveyResponsesContent() {
  const searchParams = useSearchParams();
  // Dashboard links use moduleId; older survey links put the ID in module.
  const moduleId = searchParams.get('moduleId') || searchParams.get('module');
  const moduleName = searchParams.get('name') || searchParams.get('module');

  const [module, setModule] = useState(null);
  const [surveyConfig, setSurveyConfig] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSurveyData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load module
      const moduleData = await apiClient.get(`/api/modules/${moduleId}`);
      setModule(moduleData);

      // Load survey config (to get questions)
      const config = await apiClient.get(`/api/modules/${moduleId}/survey`);
      setSurveyConfig(config);

      // Load all survey responses
      const responsesData = await apiClient.get(`/api/modules/${moduleId}/survey/responses`);
      setResponses(responsesData);

      console.log('📊 Loaded survey data:', {
        module: moduleData.name,
        questions: config.survey_questions?.length,
        responses: responsesData.length
      });
    } catch (err) {
      console.error('Failed to load survey data:', err);
      setError('Failed to load survey responses. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    if (moduleId) {
      loadSurveyData();
    } else {
      setError('No module selected. Open survey responses from a module dashboard.');
      setLoading(false);
    }
  }, [moduleId, loadSurveyData]);

  const exportToCSV = () => {
    if (!responses || responses.length === 0 || !surveyConfig) return;

    // Build CSV headers
    const headers = ['Student ID', 'Submitted At'];
    surveyConfig.survey_questions.forEach((q, idx) => {
      headers.push(`Q${idx + 1}: ${q.question}`);
    });

    // Build CSV rows
    const rows = responses.map(response => {
      const row = [
        response.student_id,
        new Date(response.submitted_at).toLocaleString()
      ];

      // Add answers for each question
      surveyConfig.survey_questions.forEach(q => {
        row.push(response.responses[q.id] || '');
      });

      return row;
    });

    // Convert to CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${module?.name || moduleName || "module"}-survey-responses.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="large" text="Loading survey responses..." />
      </div>
    );
  }

  if (error || !module || !surveyConfig) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-600 dark:text-red-300 mb-4">{error || 'Module or survey not found'}</p>
              {moduleId && <Button variant="outline" onClick={loadSurveyData} className="mr-2">Try again</Button>}
              <Button asChild>
                <Link href="/mymodules">Back to Modules</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href={`/dashboard?${new URLSearchParams({ module: module.name, moduleId })}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
                <ClipboardList className="w-8 h-8" />
                Survey Responses
              </h1>
              <p className="text-muted-foreground">
                Module: <span className="font-semibold">{module.name}</span>
              </p>
            </div>

            {responses.length > 0 && (
              <Button onClick={exportToCSV} variant="outline" size="lg">
                <Download className="w-4 h-4 mr-2" />
                Export to CSV
              </Button>
            )}
          </div>
        </div>

        {/* Summary */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {responses.length}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Total Responses</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {surveyConfig.survey_questions?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Questions</p>
              </div>
              <div className="text-center">
                {surveyConfig.survey_required ? (
                  <Badge variant="destructive" className="text-lg px-4 py-1">Required</Badge>
                ) : (
                  <Badge variant="secondary" className="text-lg px-4 py-1">Optional</Badge>
                )}
                <p className="text-sm text-muted-foreground mt-2">Survey Status</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <Card className="mb-6 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-2 text-red-800 dark:text-red-200">
                <AlertCircle className="w-5 h-5 mt-0.5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Responses List */}
        {responses.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <ClipboardList className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-muted-foreground text-lg mb-2">No responses yet</p>
                <p className="text-sm text-muted-foreground">
                  Students haven&apos;t submitted any survey responses for this module yet.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {responses.map((response, responseIdx) => (
              <Card key={response.id} className="border-2">
                <CardHeader className="bg-muted/50 dark:bg-card/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        Student {response.student_id}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-2">
                        <Calendar className="w-4 h-4" />
                        Submitted: {new Date(response.submitted_at).toLocaleString()}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-sm">
                      Response #{responseIdx + 1}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    {surveyConfig.survey_questions.map((question, qIdx) => (
                      <div key={question.id} className="border-b border-border pb-6 last:border-0 last:pb-0">
                        <div className="flex items-start gap-3 mb-3">
                          <Badge variant="secondary" className="mt-1">Q{qIdx + 1}</Badge>
                          <div className="flex-1">
                            <p className="font-medium text-base text-foreground mb-1">
                              {question.question}
                              {question.required && <span className="text-red-500 ml-1">*</span>}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {question.type === 'short' ? 'Short Answer' : 'Long Answer'}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="ml-14 mt-3">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                            <div className="flex-1 p-4 rounded-lg bg-muted/50 dark:bg-card border border-border ">
                              {response.responses[question.id] ? (
                                <p className="text-foreground whitespace-pre-wrap break-words">
                                  {response.responses[question.id]}
                                </p>
                              ) : (
                                <p className="text-muted-foreground italic">No response provided</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SurveyResponsesPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SurveyResponsesContent />
    </Suspense>
  );
}
