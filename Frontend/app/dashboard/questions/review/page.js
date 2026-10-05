'use client';

import { MathText } from "@/components/MathText";
import { Suspense, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  CheckCircle2,
  XCircle,
  Edit3,
  Trash2,
  Sparkles,
  AlertCircle,
  Loader2,
  ArrowLeft,
  CheckCheck,
} from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/auth";

function QuestionReviewContent() {
  const { user, loading, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const moduleId = searchParams.get("module_id");
  const moduleNameFromUrl = searchParams.get("module_name");
  const status = searchParams.get("status") || "unreviewed";

  const [questions, setQuestions] = useState([]);
  const [moduleName, setModuleName] = useState(moduleNameFromUrl || "");
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isApproving, setIsApproving] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState(new Set());

  const fetchQuestions = useCallback(async () => {
    if (!moduleId) return;

    try {
      setIsLoading(true);
      const data = await apiClient.get(`/api/questions/by-module?module_id=${moduleId}&status=${status}`);
      setQuestions(data);
    } catch (error) {
      console.error("Failed to fetch questions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [moduleId, status]);

  useEffect(() => {
    const fetchModuleInfo = async () => {
      // If module name is already in the URL, no need to fetch
      if (moduleNameFromUrl) {
        console.log("✅ Module name from URL:", moduleNameFromUrl);
        return;
      }

      if (!moduleId || !user) {
        console.log("⚠️ Cannot fetch module info - missing moduleId or user", { moduleId, user: user?.id });
        return;
      }

      try {
        console.log("🔍 Fetching module info for moduleId:", moduleId);
        // Fetch module info to get the module name (fallback if not in URL)
        const modules = await apiClient.get(`/api/modules?teacher_id=${user.id}`);
        console.log("📚 Found modules:", modules.length);
        const foundModule = modules.find(m => m.id === moduleId);
        if (foundModule) {
          console.log("✅ Module found:", foundModule.name);
          setModuleName(foundModule.name);
        } else {
          console.error("❌ Module not found for ID:", moduleId);
        }
      } catch (error) {
        console.error("❌ Failed to fetch module name:", error);
      }
    };

    if (isAuthenticated && moduleId) {
      fetchQuestions();
      if (user) {
        fetchModuleInfo();
      }
    }
  }, [isAuthenticated, moduleId, user, moduleNameFromUrl, fetchQuestions]);

  const handleApprove = async (questionId) => {
    try {
      setIsApproving(questionId);
      await apiClient.put(`/api/questions/${questionId}/approve`);
      // Remove from list
      setQuestions(questions.filter(q => q.id !== questionId));
    } catch (error) {
      console.error("Approve error:", error);
      alert("Failed to approve question");
    } finally {
      setIsApproving(null);
    }
  };

  const handleDelete = async (questionId) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    try {
      setIsDeleting(questionId);
      await apiClient.delete(`/api/questions/${questionId}`);
      setQuestions(questions.filter(q => q.id !== questionId));
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete question");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleEdit = (question) => {
    setEditingId(question.id);
    setEditForm({
      text: question.text,
      options: question.options || {},
      correct_option_id: question.correct_option_id || "",
      correct_answer: question.correct_answer || "",
      learning_outcome: question.learning_outcome || "",
    });
  };

  const handleSaveEdit = async (questionId) => {
    try {
      const updatedQuestion = await apiClient.put(`/api/questions/${questionId}`, {
        ...editForm,
        status: "active" // Auto-approve when edited
      });
      setQuestions(questions.filter(q => q.id !== questionId)); // Remove from unreviewed list
      setEditingId(null);
    } catch (error) {
      console.error("Update error:", error);
      alert("Failed to update question");
    }
  };

  const handleBulkApprove = async () => {
    if (selectedQuestions.size === 0) {
      alert("Please select at least one question to approve");
      return;
    }

    try {
      setIsBulkApproving(true);
      await apiClient.post("/api/questions/bulk-approve", {
        question_ids: Array.from(selectedQuestions)
      });
      // Remove approved questions from list
      setQuestions(questions.filter(q => !selectedQuestions.has(q.id)));
      setSelectedQuestions(new Set());
      alert(`Successfully approved ${selectedQuestions.size} question(s)`);
    } catch (error) {
      console.error("Bulk approve error:", error);
      alert("Failed to approve questions");
    } finally {
      setIsBulkApproving(false);
    }
  };

  const toggleSelection = (questionId) => {
    const newSelection = new Set(selectedQuestions);
    if (newSelection.has(questionId)) {
      newSelection.delete(questionId);
    } else {
      newSelection.add(questionId);
    }
    setSelectedQuestions(newSelection);
  };

  const selectAll = () => {
    setSelectedQuestions(new Set(questions.map(q => q.id)));
  };

  const deselectAll = () => {
    setSelectedQuestions(new Set());
  };

  if (loading) return <div className="p-8">Loading...</div>;

  if (!isAuthenticated) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl mb-4">Access Denied</h1>
        <Button asChild><Link href="/sign-in">Sign In</Link></Button>
      </div>
    );
  }

  if (!moduleId) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl mb-4">No Module Selected</h1>
        <Button asChild><Link href="/mymodules">Go to My Modules</Link></Button>
      </div>
    );
  }

  const getQuestionTypeBadge = (type) => {
    switch (type) {
      case 'mcq':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30">Multiple Choice</Badge>;
      case 'short':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30">Short Answer</Badge>;
      case 'long':
        return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30">Long Answer</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="min-h-screen bg-background">
          <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                {moduleName ? (
                  <Button
                    variant="outline"
                    asChild
                    onClick={() => console.log("🔙 Navigating back to questions with module:", moduleName)}
                  >
                    <Link href={`/dashboard/questions?module=${encodeURIComponent(moduleName)}`}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Questions
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" disabled>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Loading...
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Sparkles className="w-8 h-8 text-purple-500" />
                    Review AI-Generated Questions
                  </h1>
                  <p className="text-muted-foreground mt-2">
                    {moduleName ? (
                      <>Module: <strong>{moduleName}</strong> • Review and approve questions before they become available to students</>
                    ) : (
                      <>Loading module information...</>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-purple-600">{questions.length}</p>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                </div>
              </div>
            </div>

            {/* Bulk Actions Bar */}
            {questions.length > 0 && (
              <Card className="mb-6 border-purple-200 dark:border-purple-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <p className="text-sm font-medium">
                        {selectedQuestions.size} of {questions.length} selected
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={selectAll}
                        >
                          Select All
                        </Button>
                        {selectedQuestions.size > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={deselectAll}
                          >
                            Deselect All
                          </Button>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={handleBulkApprove}
                      disabled={selectedQuestions.size === 0 || isBulkApproving}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isBulkApproving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <CheckCheck className="w-4 h-4 mr-2" />
                          Approve Selected ({selectedQuestions.size})
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Questions List */}
            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Loading questions...</p>
              </div>
            ) : questions.length > 0 ? (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <Card key={question.id} className="border-l-4 border-l-purple-500">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedQuestions.has(question.id)}
                            onChange={() => toggleSelection(question.id)}
                            className="mt-1 h-4 w-4 rounded border-gray-300"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-muted-foreground">Q{index + 1}</span>
                              {getQuestionTypeBadge(question.type)}
                              <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/30">
                                <Sparkles className="w-3 h-3 mr-1" />
                                AI Generated
                              </Badge>
                            </div>
                            {editingId === question.id ? (
                              <div className="space-y-3">
                                <Textarea
                                  value={editForm.text}
                                  onChange={(e) => setEditForm({ ...editForm, text: e.target.value })}
                                  className="font-medium"
                                  rows={3}
                                />
                                {question.type === 'mcq' && (
                                  <div className="space-y-2 pl-4">
                                    {Object.entries(editForm.options || {}).map(([key, value]) => (
                                      <div key={key} className="flex items-center gap-2">
                                        <span className="font-semibold">{key}.</span>
                                        <Input
                                          value={value}
                                          onChange={(e) => setEditForm({
                                            ...editForm,
                                            options: { ...editForm.options, [key]: e.target.value }
                                          })}
                                          className="flex-1"
                                        />
                                        <input
                                          type="radio"
                                          name={`correct-${question.id}`}
                                          checked={editForm.correct_option_id === key}
                                          onChange={() => setEditForm({ ...editForm, correct_option_id: key })}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {(question.type === 'short' || question.type === 'long') && (
                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-green-700 dark:text-green-400">
                                      Expected Answer (for AI feedback):
                                    </Label>
                                    <Textarea
                                      value={editForm.correct_answer || ""}
                                      onChange={(e) => setEditForm({ ...editForm, correct_answer: e.target.value })}
                                      placeholder="Enter the expected answer..."
                                      rows={question.type === 'long' ? 4 : 2}
                                      className="bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800"
                                    />
                                  </div>
                                )}
                                <Input
                                  value={editForm.learning_outcome}
                                  onChange={(e) => setEditForm({ ...editForm, learning_outcome: e.target.value })}
                                  placeholder="Learning outcome"
                                  className="text-sm"
                                />
                              </div>
                            ) : (
                              <>
                                <CardTitle className="text-lg mb-3"><MathText inline>{question.text}</MathText></CardTitle>
                                {question.type === 'mcq' && question.options && (
                                  <div className="space-y-2 pl-4">
                                    {Object.entries(question.options).map(([key, value]) => (
                                      <div key={key} className="flex items-center gap-2">
                                        <span className="font-semibold">{key}.</span>
                                        <span className={key === question.correct_option_id ? "font-semibold text-green-600" : ""}>
                                          <MathText inline>{value}</MathText>
                                        </span>
                                        {key === question.correct_option_id && (
                                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {(question.type === 'short' || question.type === 'long') && question.correct_answer && (
                                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                                    <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-1">
                                      Expected Answer (for AI feedback):
                                    </p>
                                    <p className="text-sm text-green-900 dark:text-green-100 whitespace-pre-wrap">
                                      <MathText inline>{question.correct_answer}</MathText>
                                    </p>
                                  </div>
                                )}
                                {question.learning_outcome && (
                                  <p className="text-sm text-muted-foreground mt-3">
                                    <strong>Learning Outcome:</strong> <MathText inline>{question.learning_outcome}</MathText>
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        {editingId === question.id ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(question.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Save & Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(question.id)}
                              disabled={isApproving === question.id}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {isApproving === question.id ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(question)}
                            >
                              <Edit3 className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(question.id)}
                              disabled={isDeleting === question.id}
                            >
                              {isDeleting === question.id ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 mr-1" />
                              )}
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-2">
                <CardContent className="p-12 text-center">
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
                  <h3 className="text-xl font-semibold mb-2">All Caught Up!</h3>
                  <p className="text-muted-foreground mb-6">
                    There are no questions pending review at this time.
                  </p>
                  <Button asChild>
                    <Link href="/dashboard/documents">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate More Questions
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function QuestionReviewPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <QuestionReviewContent />
    </Suspense>
  );
}
