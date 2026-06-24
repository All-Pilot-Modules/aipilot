'use client';

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  Star,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  User,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
  BarChart3
} from "lucide-react";
import { apiClient } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function FeedbackCritiquesPage() {
  
  const searchParams = useSearchParams();
  const moduleName = searchParams?.get('module');
  const { user, loading: authLoading } = useAuth();

  const [currentModule, setCurrentModule] = useState(null);
  const [critiquesData, setCritiquesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedStudents, setExpandedStudents] = useState(new Set());

  useEffect(() => {
    if (authLoading) return;
    if (!moduleName || !user) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");

        const userId = user?.id || user?.sub;

        // Fetch module details
        const modulesResponse = await apiClient.get(`/api/modules?teacher_id=${userId}`);
        const modules = modulesResponse || [];
        // eslint-disable-next-line @next/next/no-assign-module-variable
        const foundModule = modules.find(m => m.name === moduleName);

        if (!foundModule) {
          setError("Module not found");
          return;
        }

        setCurrentModule(foundModule);

        // Fetch feedback critiques data (now includes embedded feedback, answer, and question)
        const critiquesResponse = await apiClient.get(
          `/api/student/modules/${foundModule.id}/feedback-critiques`
        );
        const data = critiquesResponse?.data || critiquesResponse;
        setCritiquesData(data);

      } catch (err) {
        console.error('Error fetching critiques:', err);
        setError(err.message || "Failed to load feedback critiques");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [moduleName, user, authLoading]);

  // Group critiques by student
  const studentCritiques = useMemo(() => {
    if (!critiquesData?.critiques) return [];

    const groupedMap = {};

    critiquesData.critiques.forEach(critique => {
      if (!groupedMap[critique.student_id]) {
        groupedMap[critique.student_id] = {
          student_id: critique.student_id,
          critiques: [],
          totalRating: 0,
          count: 0
        };
      }

      groupedMap[critique.student_id].critiques.push(critique);
      groupedMap[critique.student_id].totalRating += critique.rating;
      groupedMap[critique.student_id].count += 1;
    });

    return Object.values(groupedMap).map(student => ({
      ...student,
      averageRating: student.totalRating / student.count
    }));
  }, [critiquesData]);

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    if (!searchTerm) return studentCritiques;
    return studentCritiques.filter(student =>
      student.student_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [studentCritiques, searchTerm]);

  const toggleStudent = (studentId) => {
    setExpandedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const getRatingColor = (rating) => {
    if (rating >= 4) return "text-green-600 dark:text-green-400";
    if (rating >= 3) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'helpful':
        return <ThumbsUp className="w-3 h-3 text-green-600" />;
      case 'not_helpful':
        return <ThumbsDown className="w-3 h-3 text-red-600" />;
      case 'incorrect':
        return <AlertCircle className="w-3 h-3 text-orange-600" />;
      default:
        return <MessageSquare className="w-3 h-3 text-gray-600" />;
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      'helpful': 'Helpful',
      'not_helpful': 'Not Helpful',
      'incorrect': 'Incorrect',
      'too_vague': 'Too Vague',
      'too_harsh': 'Too Harsh'
    };
    return labels[category] || category;
  };

  const formatAnswer = (answer, options = null) => {
    if (!answer) return null;

    // Normalize options to a dictionary format {"A": "Apple", "B": "Ball"}
    let optionsDict = {};

    if (options) {
      if (Array.isArray(options)) {
        // Convert array format to dict: [{id: "A", text: "Apple"}] => {"A": "Apple"}
        options.forEach(opt => {
          if (opt?.id && opt?.text) {
            optionsDict[opt.id] = opt.text;
          }
        });
      } else if (typeof options === 'object') {
        // Already in dict format {"A": "Apple"}
        optionsDict = options;
      }
    }

    // Handle object answers (e.g., {selected_option_id: "A"})
    if (typeof answer === 'object' && !Array.isArray(answer)) {
      // Handle text_response objects (e.g., {text_response: "two"})
      if (answer.text_response !== undefined) {
        return answer.text_response;
      }

      // Handle selected_option_id objects
      if (answer.selected_option_id !== undefined) {
        const optionId = answer.selected_option_id;

        if (optionsDict[optionId]) {
          return `${optionId}: ${optionsDict[optionId]}`;
        }
        return `Option ${optionId}`;
      }

      // Handle selected_options (multiple choice multiple answer)
      if (answer.selected_options && Array.isArray(answer.selected_options)) {
        return answer.selected_options
          .map(optId => optionsDict[optId] ? `${optId}: ${optionsDict[optId]}` : `Option ${optId}`)
          .join(', ');
      }

      // Handle blanks (fill in the blank)
      if (answer.blanks && typeof answer.blanks === 'object') {
        return Object.entries(answer.blanks)
          .map(([key, value]) => `${key}: "${value}"`)
          .join(', ');
      }

      // Handle sub_answers (multi-part questions)
      if (answer.sub_answers && typeof answer.sub_answers === 'object') {
        return Object.entries(answer.sub_answers)
          .map(([key, value]) => `Part ${key}: ${value}`)
          .join(', ');
      }

      // Generic object formatting (fallback)
      return Object.entries(answer)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }

    // Handle arrays
    if (Array.isArray(answer)) {
      return answer.join(', ');
    }

    // Handle string option IDs (e.g., just "A")
    if (typeof answer === 'string' && optionsDict[answer]) {
      return `${answer}: ${optionsDict[answer]}`;
    }

    return String(answer);
  };

  if (authLoading || loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="p-6">
            <Skeleton className="h-8 w-64 mb-4" />
            <Skeleton className="h-40 w-full mb-4" />
            <Skeleton className="h-96 w-full" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (error) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="p-6">
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
              <CardContent className="pt-6">
                <p className="text-red-600 dark:text-red-400">{error}</p>
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
        <div className="p-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-gray-900" />
              Feedback Critiques
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Student reviews of AI-generated feedback for {moduleName}
            </p>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gray-900 dark:from-gray-800/50 dark:to-gray-900/50 border-gray-200 dark:border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-800 dark:text-gray-400 font-medium">Total Students</p>
                    <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{studentCritiques.length}</p>
                  </div>
                  <User className="w-8 h-8 text-gray-900 dark:text-gray-300" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 dark:from-gray-800/50 dark:to-gray-900/50 border-gray-200 dark:border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-800 dark:text-gray-400 font-medium">Total Critiques</p>
                    <p className="text-3xl font-bold text-purple-900 dark:text-gray-100">{critiquesData?.total_critiques || 0}</p>
                  </div>
                  <MessageSquare className="w-8 h-8 text-gray-700 dark:text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/50 border-amber-200 dark:border-amber-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">Average Rating</p>
                    <p className={`text-3xl font-bold ${critiquesData?.average_rating ? getRatingColor(critiquesData.average_rating) : 'text-gray-400'}`}>
                      {critiquesData?.average_rating ? critiquesData.average_rating.toFixed(1) : 'N/A'}
                    </p>
                  </div>
                  <Star className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/50 border-emerald-200 dark:border-emerald-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">Critique Rate</p>
                    <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">{critiquesData?.critique_rate || 0}%</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search Bar */}
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search by student ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Students List */}
          {filteredStudents.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Students ({filteredStudents.length})
                </CardTitle>
                <CardDescription>
                  Click on a student to view their feedback critiques
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredStudents.map((student) => (
                  <div key={student.student_id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                    {/* Student Header */}
                    <button
                      onClick={() => toggleStudent(student.student_id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-muted/20 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-gray-900 dark:text-gray-300" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            Student {student.student_id}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {student.count} critique{student.count !== 1 ? 's' : ''}
                            </span>
                            <div className="flex items-center gap-1">
                              <Star className={`w-4 h-4 fill-yellow-400 text-yellow-400`} />
                              <span className={`text-sm font-medium ${getRatingColor(student.averageRating)}`}>
                                {student.averageRating.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {expandedStudents.has(student.student_id) ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>

                    {/* Student Critiques (Expanded) */}
                    {expandedStudents.has(student.student_id) && (
                      <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4 bg-gray-50 dark:bg-gray-800/30">
                        {student.critiques.map((critique, index) => {
                          return (
                            <div key={critique.id} className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                              {/* Question */}
                              <div className="mb-3">
                                <div className="flex items-start gap-2 mb-2">
                                  <FileText className="w-4 h-4 text-gray-900 mt-1 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Question:</p>
                                    <p className="text-sm text-gray-900 dark:text-white mb-2">
                                      {critique.question?.text || "Question not found"}
                                    </p>
                                    {critique.question?.options && Object.keys(critique.question.options).length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Options:</p>
                                        <div className="space-y-1">
                                          {Object.entries(critique.question.options).map(([key, value]) => (
                                            <div key={key} className="text-xs text-gray-700 dark:text-gray-300">
                                              <span className="font-medium">{key}:</span> {value}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Student Answer */}
                              {critique.answer && (
                                <div className="mb-3 pl-6">
                                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Student Answer:</p>
                                  <div className="bg-gray-50 dark:bg-muted/20/20 p-3 rounded border border-gray-200 dark:border-border">
                                    <p className="text-sm text-gray-800 dark:text-gray-200">
                                      {formatAnswer(critique.answer.answer, critique.question?.options) || 'No answer provided'}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* AI Feedback */}
                              {critique.feedback && (
                                <div className="mb-3 pl-6">
                                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">AI Feedback:</p>
                                  <div className="bg-gray-50 dark:bg-muted/20/20 p-3 rounded border border-gray-200 dark:border-border">
                                    <p className="text-sm text-gray-800 dark:text-gray-200">
                                      {critique.feedback.feedback_text || 'No feedback text'}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Student Critique */}
                              <div className="pl-6 pt-3 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Student&apos;s Critique:</p>

                                <div className="flex items-center gap-3 mb-2">
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`w-4 h-4 ${
                                          i < critique.rating
                                            ? 'fill-yellow-400 text-yellow-400'
                                            : 'text-gray-300 dark:text-gray-600'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <span className={`font-bold text-sm ${getRatingColor(critique.rating)}`}>
                                    {critique.rating}/5
                                  </span>

                                  {critique.feedback_type && (
                                    <Badge variant="outline" className="flex items-center gap-1">
                                      {getCategoryIcon(critique.feedback_type)}
                                      {getCategoryLabel(critique.feedback_type)}
                                    </Badge>
                                  )}
                                </div>

                                {critique.comment && (
                                  <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
                                    <p className="text-sm text-gray-800 dark:text-gray-200 italic">
                                      &quot;{critique.comment}&quot;
                                    </p>
                                  </div>
                                )}

                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                  Submitted on {new Date(critique.created_at).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {searchTerm ? 'No students found' : 'No Feedback Critiques Yet'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchTerm
                    ? 'Try adjusting your search terms'
                    : 'Students haven\'t submitted any critiques for AI feedback in this module yet.'
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
