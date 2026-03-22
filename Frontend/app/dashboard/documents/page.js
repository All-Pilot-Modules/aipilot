'use client';

import { Suspense, useState, useEffect, useCallback, useMemo, memo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Dynamically import AlertDialog components
const AlertDialog = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialog })), { ssr: false });
const AlertDialogAction = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogAction })), { ssr: false });
const AlertDialogCancel = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogCancel })), { ssr: false });
const AlertDialogContent = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogContent })), { ssr: false });
const AlertDialogDescription = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogDescription })), { ssr: false });
const AlertDialogFooter = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogFooter })), { ssr: false });
const AlertDialogHeader = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogHeader })), { ssr: false });
const AlertDialogTitle = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogTitle })), { ssr: false });
import { Upload, FolderOpen, File, FileText, FileVideo, Image as ImageIcon, Archive, Calendar, Edit3, Trash2, Download, Search, BookOpen, FileCheck, Clock, HardDrive, TrendingUp, Eye, Share2, ChevronRight, Plus, X, CheckCircle2, Loader2, AlertCircle, Database, Sparkles, Cpu } from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/auth";
import { SkeletonDocumentCard } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

function DocumentsContent() {
  const { user, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const moduleName = searchParams.get("module");
  const moduleIdFromParam = searchParams.get("moduleId");

  const [documents, setDocuments] = useState([]);
  const [currentModule, setCurrentModule] = useState(null);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [availableModules, setAvailableModules] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all"); // "all" | "testbank" | "regular"
  const [uploadForm, setUploadForm] = useState({ title: "", file: null });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [selectedDocForGeneration, setSelectedDocForGeneration] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationForm, setGenerationForm] = useState({ num_short: 0, num_long: 0, num_mcq: 0 });
  const [uploadStage, setUploadStage] = useState(0);
  const [isTestbank, setIsTestbank] = useState(false);

  const fetchModuleAndDocuments = useCallback(async () => {
    try {
      setIsLoadingDocuments(true);

      const userId = user?.id || user?.sub;
      if (!userId) {
        setIsLoadingDocuments(false);
        return;
      }

      if (moduleIdFromParam) {
        // Skip module list fetch — ID is already in the URL
        const [moduleData, documentsData] = await Promise.all([
          apiClient.get(`/api/modules/${moduleIdFromParam}`),
          apiClient.get(`/api/documents?teacher_id=${userId}&module_id=${moduleIdFromParam}`),
        ]);
        setCurrentModule(moduleData);
        setAvailableModules([moduleData]);
        setDocuments(documentsData);
      } else {
        const moduleList = await apiClient.get(`/api/modules?teacher_id=${userId}`);
        setAvailableModules(moduleList || []);

        // eslint-disable-next-line @next/next/no-assign-module-variable
        const module = moduleList.find(m => m.name === moduleName);
        if (module) {
          setCurrentModule(module);
          const documentsData = await apiClient.get(`/api/documents?teacher_id=${userId}&module_id=${module.id}`);
          setDocuments(documentsData);
        } else {
          setCurrentModule(null);
        }
      }
    } catch (error) {
      console.error("Failed to fetch module or documents:", error);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [user?.id, user?.sub, moduleName, moduleIdFromParam]);

  // Load module and documents
  useEffect(() => {
    if (isAuthenticated && (user?.id || user?.sub) && moduleName) {
      fetchModuleAndDocuments();
    }
  }, [isAuthenticated, user?.id, user?.sub, moduleName, fetchModuleAndDocuments]);

  // Reset form when drawer closes
  useEffect(() => {
    if (!isUploadOpen) {
      setUploadForm({ title: "", file: null });
      setIsTestbank(false);
    }
  }, [isUploadOpen]);

  // Cycle through upload stages
  useEffect(() => {
    if (isUploading) {
      setUploadStage(0);
      // Different stages for testbank vs regular documents
      const stages = isTestbank
        ? [0, 1, 2, 3] // uploading, extracting, parsing questions, saving
        : [0, 1, 2]; // uploading, extracting, embedding
      let currentStageIndex = 0;

      const interval = setInterval(() => {
        currentStageIndex = (currentStageIndex + 1) % stages.length;
        setUploadStage(stages[currentStageIndex]);
      }, isTestbank ? 2500 : 2000); // Slightly slower for testbank (more stages)

      return () => clearInterval(interval);
    }
  }, [isUploading, isTestbank]);

  const getFileIcon = (type) => {
    switch (type?.toLowerCase()) {
      case "pdf": return <FileText className="w-5 h-5 text-red-500" />;
      case "docx":
      case "doc": return <File className="w-5 h-5 text-blue-500" />;
      case "pptx":
      case "ppt": return <FileVideo className="w-5 h-5 text-orange-500" />;
      case "jpg":
      case "jpeg":
      case "png": return <ImageIcon className="w-5 h-5 text-green-500" />;
      case "zip":
      case "rar": return <Archive className="w-5 h-5 text-purple-500" />;
      default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (processingStatus) => {
    // Handle different status values that might come from the API
    // Backend uses 'processing_status' field
    const normalizedStatus = processingStatus?.toLowerCase() || 'uploaded';

    switch (normalizedStatus) {
      case 'embedded':
      case 'indexed':
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Embedded
          </Badge>
        );
      case 'chunked':
      case 'extracted':
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">
            <Database className="w-3 h-3 mr-1" />
            Processed
          </Badge>
        );
      case 'extracting':
      case 'chunking':
      case 'embedding':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case 'uploaded':
      default:
        return (
          <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800">
            <Upload className="w-3 h-3 mr-1" />
            Uploaded
          </Badge>
        );
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase());

    // Type filter: testbank vs regular
    if (typeFilter === "testbank" && !doc.is_testbank) return false;
    if (typeFilter === "regular" && doc.is_testbank) return false;

    if (statusFilter === "all") {
      return matchesSearch;
    }

    const docStatus = doc.processing_status?.toLowerCase() || 'uploaded';

    if (statusFilter === "embedded") {
      return matchesSearch && (docStatus === 'embedded' || docStatus === 'indexed');
    } else if (statusFilter === "processed") {
      return matchesSearch && (docStatus === 'chunked' || docStatus === 'extracted');
    } else if (statusFilter === "processing") {
      return matchesSearch && (docStatus === 'extracting' || docStatus === 'chunking' || docStatus === 'embedding');
    } else if (statusFilter === "failed") {
      return matchesSearch && docStatus === 'failed';
    } else if (statusFilter === "uploaded") {
      return matchesSearch && docStatus === 'uploaded';
    }

    return matchesSearch;
  });

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!uploadForm.file) {
      alert("Please select a file to upload");
      return;
    }

    if (!currentModule) {
      alert("Module not found. Please refresh the page and try again.");
      return;
    }

    const userId = user?.id || user?.sub;
    if (!userId) {
      alert("User session error. Please refresh the page and try again.");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("module_name", currentModule.name);
      formData.append("teacher_id", userId);
      formData.append("title", uploadForm.title || uploadForm.file.name);

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (response.ok) {
        const newDoc = await response.json();
        setDocuments([newDoc, ...documents]);
        setUploadForm({ title: "", file: null });
        setIsUploadOpen(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.detail || `Upload failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed. Please check your connection and try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!selectedDocument) return;

    try {
      const updatedDoc = await apiClient.put(`/api/documents/${selectedDocument.id}`, {
        title: uploadForm.title,
      });
      setDocuments(docs => docs.map(d => d.id === selectedDocument.id ? updatedDoc : d));
      setIsEditOpen(false);
      setSelectedDocument(null);
    } catch (error) {
      console.error("Edit error:", error);
      alert("Failed to update document. Please try again.");
    }
  };

  const handleDelete = (doc) => {
    // Check if it's a testbank - if so, show custom dialog
    if (doc.is_testbank) {
      setDocumentToDelete(doc);
      setDeleteDialogOpen(true);
    } else {
      // For regular documents, use simple confirmation
      if (!confirm("Are you sure you want to delete this document?")) return;
      executeDelete(doc.id, false);
    }
  };

  const executeDelete = async (id, deleteQuestions) => {
    try {
      setIsDeleting(id);
      setDeleteDialogOpen(false);

      // Add query parameter if deleteQuestions is true
      const url = deleteQuestions
        ? `/api/documents/${id}?delete_questions=true`
        : `/api/documents/${id}`;

      await apiClient.delete(url);
      setDocuments(docs => docs.filter(d => d.id !== id));
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setIsDeleting(null);
      setDocumentToDelete(null);
    }
  };

  const handleGenerateQuestions = async (e) => {
    e.preventDefault();
    if (!selectedDocForGeneration) return;

    const total = generationForm.num_short + generationForm.num_long + generationForm.num_mcq;
    if (total === 0) {
      alert("Please specify at least one question to generate");
      return;
    }
    if (total > 100) {
      alert("Cannot generate more than 100 questions at once");
      return;
    }

    try {
      setIsGenerating(true);
      const response = await apiClient.post(
        `/api/documents/${selectedDocForGeneration.id}/generate-questions`,
        generationForm
      );

      // Close modal
      setIsGenerateOpen(false);
      setSelectedDocForGeneration(null);
      setGenerationForm({ num_short: 0, num_long: 0, num_mcq: 0 });

      // Show success message
      alert(`Successfully generated ${response.generated_count} questions! Redirecting to review page...`);

      // Redirect to review page
      window.location.href = response.review_url;
    } catch (error) {
      console.error("Generate error:", error);
      alert(error.response?.data?.detail || "Failed to generate questions. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated)
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center min-h-screen bg-background">
            <Card className="max-w-md w-full mx-4">
              <CardContent className="pt-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                <p className="text-muted-foreground mb-6">
                  Please sign in to access the documents page.
                </p>
                <Button asChild size="lg">
                  <Link href="/sign-in">Sign In</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );

  if (!moduleName)
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center min-h-screen bg-background">
            <Card className="max-w-md w-full mx-4">
              <CardContent className="pt-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">No Module Selected</h2>
                <p className="text-muted-foreground mb-6">
                  Please select a module from your modules list to view and upload documents.
                </p>
                <Button asChild size="lg">
                  <Link href="/mymodules">
                    <FolderOpen className="w-5 h-5 mr-2" />
                    Go to My Modules
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );

  // Show error if module not found after loading
  if (!isLoadingDocuments && !currentModule && moduleName) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center min-h-screen bg-background">
            <Card className="max-w-lg w-full mx-4">
              <CardContent className="pt-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Module Not Found</h2>
                <p className="text-muted-foreground mb-4">
                  The module &quot;{moduleName}&quot; does not exist.
                </p>
                {availableModules.length === 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-6">
                      You don&apos;t have any modules yet. Create your first module to get started!
                    </p>
                    <Button asChild size="lg">
                      <Link href="/mymodules">
                        <Plus className="w-5 h-5 mr-2" />
                        Create Your First Module
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      Available modules:
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center mb-6">
                      {availableModules.map((mod) => (
                        <Badge key={mod.id} variant="secondary" className="text-sm">
                          {mod.name}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-3 justify-center">
                      <Button asChild variant="outline">
                        <Link href="/mymodules">
                          <FolderOpen className="w-5 h-5 mr-2" />
                          View All Modules
                        </Link>
                      </Button>
                      <Button asChild>
                        <Link href={`/dashboard/documents?module=${availableModules[0].name}`}>
                          Go to {availableModules[0].name}
                        </Link>
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  // Calculate document statistics
  const totalSize = documents.reduce((acc, doc) => acc + (doc.file_size || 0), 0);
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  // Calculate status statistics
  const getStatusStats = () => {
    const stats = {
      embedded: 0,
      processed: 0,
      processing: 0,
      failed: 0,
      uploaded: 0
    };

    documents.forEach(doc => {
      const status = doc.processing_status?.toLowerCase() || 'uploaded';
      if (status === 'embedded' || status === 'indexed') {
        stats.embedded++;
      } else if (status === 'chunked' || status === 'extracted') {
        stats.processed++;
      } else if (status === 'extracting' || status === 'chunking' || status === 'embedding') {
        stats.processing++;
      } else if (status === 'failed') {
        stats.failed++;
      } else {
        stats.uploaded++;
      }
    });

    return stats;
  };

  const statusStats = getStatusStats();

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="min-h-screen bg-background">
          <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Enhanced Header */}
            <div className="mb-6 sm:mb-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 dark:from-indigo-500/5 dark:via-purple-500/5 dark:to-pink-500/5 rounded-xl sm:rounded-2xl"></div>
              <div className="relative p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl border border-border/50 backdrop-blur-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                      <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground truncate">Document Library</h1>
                        <div className="px-2 sm:px-3 py-0.5 sm:py-1 bg-primary/10 text-primary rounded-full text-xs sm:text-sm font-medium self-start sm:self-auto">
                          {currentModule?.name || moduleName}
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 sm:gap-2">
                        <FileText className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="truncate">Manage and organize your course materials</span>
                      </p>
                    </div>
                  </div>
                  <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                    <DialogTrigger asChild>
                      <Button size="default" className="shadow-lg hover:shadow-xl transition-all w-full sm:w-auto flex-shrink-0">
                        <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                        <span className="sm:inline">Upload</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      {isUploading ? (
                        <div className="py-16">
                          <div className="flex flex-col items-center justify-center space-y-8">
                            {/* Large Spinner */}
                            <div className="relative">
                              {isTestbank ? (
                                <>
                                  <div className="w-32 h-32 border-8 border-purple-200/30 rounded-full"></div>
                                  <div className="w-32 h-32 border-8 border-purple-600 border-t-transparent rounded-full animate-spin absolute top-0"></div>
                                  <div className="w-24 h-24 border-4 border-pink-500/40 border-b-transparent rounded-full animate-spin absolute top-4 left-4" style={{ animationDuration: '3s', animationDirection: 'reverse' }}></div>
                                  <Sparkles className="w-12 h-12 text-purple-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                                </>
                              ) : (
                                <>
                                  <div className="w-32 h-32 border-8 border-primary/10 rounded-full"></div>
                                  <div className="w-32 h-32 border-8 border-primary border-t-transparent rounded-full animate-spin absolute top-0"></div>
                                  <div className="w-24 h-24 border-4 border-primary/30 border-b-transparent rounded-full animate-spin absolute top-4 left-4" style={{ animationDuration: '3s', animationDirection: 'reverse' }}></div>
                                  <Upload className="w-12 h-12 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                                </>
                              )}
                            </div>

                            {/* Stage Info */}
                            <div className="text-center space-y-3">
                              {isTestbank ? (
                                <>
                                  <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-clip-text text-transparent">
                                    {uploadStage === 0 && 'Uploading Testbank'}
                                    {uploadStage === 1 && 'Extracting Questions'}
                                    {uploadStage === 2 && 'Parsing Questions'}
                                    {uploadStage === 3 && 'Saving to Database'}
                                  </h3>
                                  <p className="text-lg text-muted-foreground">
                                    {uploadStage === 0 && 'Uploading your testbank file to the server...'}
                                    {uploadStage === 1 && 'AI is analyzing and extracting text from testbank...'}
                                    {uploadStage === 2 && 'Identifying questions, options, and correct answers...'}
                                    {uploadStage === 3 && 'Saving questions to your question bank...'}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <h3 className="text-3xl font-bold">
                                    {uploadStage === 0 && 'Uploading Document'}
                                    {uploadStage === 1 && 'Extracting Content'}
                                    {uploadStage === 2 && 'Embedding Text'}
                                  </h3>
                                  <p className="text-lg text-muted-foreground">
                                    {uploadStage === 0 && 'Transferring your file to the server...'}
                                    {uploadStage === 1 && 'Analyzing and extracting text from document...'}
                                    {uploadStage === 2 && 'Creating AI embeddings for smart search...'}
                                  </p>
                                </>
                              )}
                              {uploadForm.file && (
                                <div className={`mt-6 p-6 bg-gradient-to-br rounded-xl inline-block border ${
                                  isTestbank
                                    ? 'from-purple-50 via-pink-50 to-purple-50 dark:from-purple-950/30 dark:via-pink-950/20 dark:to-purple-950/30 border-purple-200 dark:border-purple-800'
                                    : 'from-primary/5 to-primary/10 border-primary/20'
                                }`}>
                                  <div className="flex items-center gap-3 mb-3">
                                    <FileCheck className={`w-6 h-6 ${isTestbank ? 'text-purple-600' : 'text-primary'}`} />
                                    <p className="text-base font-semibold">{uploadForm.file.name}</p>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {formatFileSize(uploadForm.file.size)}
                                  </p>
                                  {isTestbank && (
                                    <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-purple-200/50 dark:bg-purple-900/50 rounded-full">
                                      <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                      <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                                        Testbank File
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Stage Progress Indicators */}
                            {isTestbank ? (
                              <div className="flex items-center gap-3 mt-4">
                                <div className="flex flex-col items-center gap-2">
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${uploadStage >= 0 ? 'bg-purple-600 text-white scale-110' : 'bg-muted text-muted-foreground'}`}>
                                    <Upload className="w-6 h-6" />
                                  </div>
                                  <span className={`text-xs font-medium ${uploadStage >= 0 ? 'text-purple-600' : 'text-muted-foreground'}`}>Upload</span>
                                </div>
                                <div className={`w-12 h-1 rounded-full transition-all ${uploadStage >= 1 ? 'bg-purple-600' : 'bg-muted'}`}></div>
                                <div className="flex flex-col items-center gap-2">
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${uploadStage >= 1 ? 'bg-purple-600 text-white scale-110' : 'bg-muted text-muted-foreground'}`}>
                                    <FileText className="w-6 h-6" />
                                  </div>
                                  <span className={`text-xs font-medium ${uploadStage >= 1 ? 'text-purple-600' : 'text-muted-foreground'}`}>Extract</span>
                                </div>
                                <div className={`w-12 h-1 rounded-full transition-all ${uploadStage >= 2 ? 'bg-purple-600' : 'bg-muted'}`}></div>
                                <div className="flex flex-col items-center gap-2">
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${uploadStage >= 2 ? 'bg-purple-600 text-white scale-110' : 'bg-muted text-muted-foreground'}`}>
                                    <Cpu className="w-6 h-6" />
                                  </div>
                                  <span className={`text-xs font-medium ${uploadStage >= 2 ? 'text-purple-600' : 'text-muted-foreground'}`}>Parse</span>
                                </div>
                                <div className={`w-12 h-1 rounded-full transition-all ${uploadStage >= 3 ? 'bg-purple-600' : 'bg-muted'}`}></div>
                                <div className="flex flex-col items-center gap-2">
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${uploadStage >= 3 ? 'bg-purple-600 text-white scale-110' : 'bg-muted text-muted-foreground'}`}>
                                    <CheckCircle2 className="w-6 h-6" />
                                  </div>
                                  <span className={`text-xs font-medium ${uploadStage >= 3 ? 'text-purple-600' : 'text-muted-foreground'}`}>Save</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-4 mt-4">
                                <div className="flex flex-col items-center gap-2">
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${uploadStage >= 0 ? 'bg-primary text-primary-foreground scale-110' : 'bg-muted text-muted-foreground'}`}>
                                    <Upload className="w-6 h-6" />
                                  </div>
                                  <span className={`text-xs font-medium ${uploadStage >= 0 ? 'text-primary' : 'text-muted-foreground'}`}>Upload</span>
                                </div>
                                <div className={`w-16 h-1 rounded-full transition-all ${uploadStage >= 1 ? 'bg-primary' : 'bg-muted'}`}></div>
                                <div className="flex flex-col items-center gap-2">
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${uploadStage >= 1 ? 'bg-primary text-primary-foreground scale-110' : 'bg-muted text-muted-foreground'}`}>
                                    <Database className="w-6 h-6" />
                                  </div>
                                  <span className={`text-xs font-medium ${uploadStage >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>Extract</span>
                                </div>
                                <div className={`w-16 h-1 rounded-full transition-all ${uploadStage >= 2 ? 'bg-primary' : 'bg-muted'}`}></div>
                                <div className="flex flex-col items-center gap-2">
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${uploadStage >= 2 ? 'bg-primary text-primary-foreground scale-110' : 'bg-muted text-muted-foreground'}`}>
                                    <Sparkles className="w-6 h-6" />
                                  </div>
                                  <span className={`text-xs font-medium ${uploadStage >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>Embed</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          <DialogHeader>
                            <DialogTitle className="text-2xl flex items-center gap-2">
                              <Upload className="w-6 h-6 text-primary" />
                              Upload New Document
                            </DialogTitle>
                            <DialogDescription>
                              Add course materials, slides, or resources for students
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleUpload} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="file">Select File</Label>
                              <Input
                                id="file"
                                type="file"
                                onChange={(e) => {
                                  const selectedFile = e.target.files[0];
                                  setUploadForm({ ...uploadForm, file: selectedFile });
                                  // Detect if this is a testbank file
                                  if (selectedFile) {
                                    const isTestbankFile = selectedFile.name.toLowerCase().includes('testbank');
                                    setIsTestbank(isTestbankFile);
                                    console.log('📋 File selected:', selectedFile.name, '| Is testbank:', isTestbankFile);
                                  }
                                }}
                                required
                              />
                              {uploadForm.file && (
                                <div className="mt-2 p-3 bg-muted rounded-lg">
                                  <div className="flex items-center gap-2 text-sm">
                                    <FileCheck className="w-4 h-4 text-green-500" />
                                    <span className="font-medium">{uploadForm.file.name}</span>
                                    <span className="text-muted-foreground ml-auto">
                                      {formatFileSize(uploadForm.file.size)}
                                    </span>
                                  </div>
                                  {isTestbank && (
                                    <div className="mt-2 flex items-center gap-2">
                                      <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                                        <Sparkles className="w-3 h-3 mr-1" />
                                        Testbank Detected
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        Questions will be auto-extracted
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="title">Document Title (optional)</Label>
                              <Input
                                id="title"
                                value={uploadForm.title}
                                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                                placeholder="Leave empty to use filename"
                              />
                            </div>
                            <DialogFooter>
                              <Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)} disabled={isUploading}>
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                disabled={isUploading || !uploadForm.file}
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                Upload
                              </Button>
                            </DialogFooter>
                          </form>
                        </>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <Card className="border-border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg transition-all">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <CardContent className="p-4 sm:p-6 relative">
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
                      <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-blue-200/50 dark:bg-blue-800/50 rounded-full">
                      <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-700 dark:text-blue-300" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Total Documents</p>
                    <p className="text-2xl sm:text-3xl font-bold text-blue-900 dark:text-blue-100">
                      {isLoadingDocuments ? '...' : documents.length}
                    </p>
                    <p className="text-[10px] sm:text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">Uploaded files</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg transition-all">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <CardContent className="p-4 sm:p-6 relative">
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
                      <HardDrive className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-purple-200/50 dark:bg-purple-800/50 rounded-full">
                      <FileCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-purple-700 dark:text-purple-300" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Total Size</p>
                    <p className="text-2xl sm:text-3xl font-bold text-purple-900 dark:text-purple-100">
                      {isLoadingDocuments ? '...' : formatFileSize(totalSize)}
                    </p>
                    <p className="text-[10px] sm:text-xs text-purple-600/70 dark:text-purple-400/70 mt-1">Storage used</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg transition-all">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <CardContent className="p-4 sm:p-6 relative">
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
                      <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-green-200/50 dark:bg-green-800/50 rounded-full">
                      <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-700 dark:text-green-300" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-green-700 dark:text-green-300 mb-1">PDF Documents</p>
                    <p className="text-2xl sm:text-3xl font-bold text-green-900 dark:text-green-100">
                      {isLoadingDocuments ? '...' : documents.filter(d => d.file_type?.toLowerCase() === 'pdf').length}
                    </p>
                    <p className="text-[10px] sm:text-xs text-green-600/70 dark:text-green-400/70 mt-1">PDF files</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg transition-all">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <CardContent className="p-4 sm:p-6 relative">
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
                      <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-emerald-200/50 dark:bg-emerald-800/50 rounded-full">
                      <Database className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-700 dark:text-emerald-300" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">Embedded</p>
                    <p className="text-2xl sm:text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                      {isLoadingDocuments ? '...' : statusStats.embedded}
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-2 text-[10px] sm:text-xs text-emerald-600/70 dark:text-emerald-400/70">
                      <span className="whitespace-nowrap">Processed: {statusStats.processed}</span>
                      {statusStats.processing > 0 && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="flex items-center gap-1 whitespace-nowrap">
                            <Loader2 className="w-2 h-2 animate-spin" />
                            Processing: {statusStats.processing}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search Bar and Filters */}
            <Card className="mb-6 sm:mb-8 border-border bg-card/50 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  <Input
                    placeholder="Search documents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 sm:pl-11 h-10 sm:h-12 text-sm sm:text-base"
                  />
                </div>

                {/* Type Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-muted-foreground">Filter by type:</span>
                  <Button
                    variant={typeFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTypeFilter("all")}
                    className="h-8"
                  >
                    All
                  </Button>
                  <Button
                    variant={typeFilter === "regular" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTypeFilter("regular")}
                    className="h-8"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    Documents
                  </Button>
                  <Button
                    variant={typeFilter === "testbank" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTypeFilter("testbank")}
                    className="h-8 border-purple-300 dark:border-purple-700 data-[state=active]:bg-purple-600"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Testbanks
                    {documents.filter(d => d.is_testbank).length > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full">
                        {documents.filter(d => d.is_testbank).length}
                      </span>
                    )}
                  </Button>
                </div>

                {/* Status Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-muted-foreground">Filter by status:</span>
                  <Button
                    variant={statusFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("all")}
                    className="h-8"
                  >
                    All
                  </Button>
                  <Button
                    variant={statusFilter === "embedded" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("embedded")}
                    className="h-8"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Embedded
                  </Button>
                  <Button
                    variant={statusFilter === "processed" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("processed")}
                    className="h-8"
                  >
                    <Database className="w-3 h-3 mr-1" />
                    Processed
                  </Button>
                  <Button
                    variant={statusFilter === "processing" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("processing")}
                    className="h-8"
                  >
                    <Loader2 className="w-3 h-3 mr-1" />
                    Processing
                  </Button>
                  <Button
                    variant={statusFilter === "uploaded" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("uploaded")}
                    className="h-8"
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    Uploaded
                  </Button>
                  {statusStats.failed > 0 && (
                    <Button
                      variant={statusFilter === "failed" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatusFilter("failed")}
                      className="h-8"
                    >
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Failed
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Documents Grid/List */}
            {isLoadingDocuments ? (
              <div className="grid grid-cols-1 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="border-border bg-card/50 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="animate-pulse flex items-center gap-4">
                        <div className="w-16 h-16 bg-muted rounded-xl"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-5 bg-muted rounded w-1/3"></div>
                          <div className="h-4 bg-muted rounded w-1/4"></div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredDocuments.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {filteredDocuments.map((doc) => {
                  const fileType = doc.file_type?.toLowerCase();
                  const getFileTypeColor = (type) => {
                    switch (type) {
                      case 'pdf': return 'from-red-500 to-red-600';
                      case 'docx':
                      case 'doc': return 'from-blue-500 to-blue-600';
                      case 'pptx':
                      case 'ppt': return 'from-orange-500 to-orange-600';
                      case 'jpg':
                      case 'jpeg':
                      case 'png': return 'from-green-500 to-green-600';
                      default: return 'from-gray-500 to-gray-600';
                    }
                  };

                  return (
                    <Card key={doc.id} className="border-border bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-lg transition-all group">
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                          <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                            <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-br ${getFileTypeColor(fileType)} rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform flex-shrink-0`}>
                              {getFileIcon(doc.file_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-base sm:text-lg truncate group-hover:text-primary transition-colors">
                                  {doc.title}
                                </h3>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1 text-xs sm:text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <File className="w-3 h-3" />
                                  {doc.file_name}
                                </span>
                                {doc.file_size && (
                                  <>
                                    <span className="hidden sm:inline">•</span>
                                    <span className="flex items-center gap-1">
                                      <HardDrive className="w-3 h-3" />
                                      {formatFileSize(doc.file_size)}
                                    </span>
                                  </>
                                )}
                                {doc.created_at && (
                                  <>
                                    <span className="hidden sm:inline">•</span>
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(doc.created_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                      })}
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Badge variant="secondary" className="text-[10px] sm:text-xs font-medium uppercase">
                                  {doc.file_type || 'FILE'}
                                </Badge>
                                {getStatusBadge(doc.processing_status)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 flex-wrap sm:flex-nowrap justify-end sm:justify-start">
                            {/* Show AI Generate button only for RAG-indexed documents */}
                            {(doc.processing_status === 'embedded' || doc.processing_status === 'indexed') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedDocForGeneration(doc);
                                  setGenerationForm({ num_short: 0, num_long: 0, num_mcq: 0 });
                                  setIsGenerateOpen(true);
                                }}
                                className="hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-400 text-xs sm:text-sm"
                              >
                                <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                                <span className="hidden sm:inline">AI Generate</span>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                                window.open(`${API_BASE_URL}/api/documents/${doc.id}/download`, '_blank');
                              }}
                              className="hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 text-xs sm:text-sm"
                            >
                              <Download className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                              <span className="hidden sm:inline">Download</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedDocument(doc);
                                setUploadForm({ title: doc.title, file: null });
                                setIsEditOpen(true);
                              }}
                              className="hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 text-xs sm:text-sm"
                            >
                              <Edit3 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                              <span className="hidden sm:inline">Edit</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(doc)}
                              disabled={isDeleting === doc.id}
                              className="hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 text-xs sm:text-sm"
                            >
                              {isDeleting === doc.id ? (
                                <>
                                  <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin sm:mr-1"></div>
                                  <span className="hidden sm:inline">Deleting</span>
                                </>
                              ) : (
                                <>
                                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                                  <span className="hidden sm:inline">Delete</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed border-2 text-center py-16 bg-card/30">
                <CardContent>
                  <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-muted to-muted/50 rounded-2xl flex items-center justify-center">
                    <FolderOpen className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No documents found</h3>
                  <p className="text-muted-foreground mb-6">
                    {searchTerm ? `No documents match "${searchTerm}"` : 'Upload your first document to get started'}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => setIsUploadOpen(true)} size="lg">
                      <Plus className="w-5 h-5 mr-2" />
                      Upload Your First Document
                    </Button>
                  )}
                  {searchTerm && (
                    <Button variant="outline" onClick={() => setSearchTerm('')}>
                      Clear Search
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Edit Document Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl flex items-center gap-2">
                    <Edit3 className="w-6 h-6 text-primary" />
                    Edit Document
                  </DialogTitle>
                  <DialogDescription>
                    Update document information
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleEdit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-title">Document Title</Label>
                    <Input
                      id="edit-title"
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                      placeholder="Enter document title"
                      required
                    />
                  </div>
                  {selectedDocument && (
                    <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Filename:</span>
                        <span className="font-medium">{selectedDocument.file_name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Type:</span>
                        <Badge variant="secondary">{selectedDocument.file_type}</Badge>
                      </div>
                      {selectedDocument.file_size && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Size:</span>
                          <span className="font-medium">{formatFileSize(selectedDocument.file_size)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      <FileCheck className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {/* AI Question Generation Dialog */}
            <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
              <DialogContent className="max-w-3xl">
                {isGenerating ? (
                  <div className="py-16">
                    <div className="flex flex-col items-center justify-center space-y-8">
                      {/* Large AI Spinner */}
                      <div className="relative">
                        <div className="w-32 h-32 border-8 border-purple-200/30 rounded-full"></div>
                        <div className="w-32 h-32 border-8 border-purple-500 border-t-transparent rounded-full animate-spin absolute top-0"></div>
                        <div className="w-24 h-24 border-4 border-pink-500/40 border-b-transparent rounded-full animate-spin absolute top-4 left-4" style={{ animationDuration: '3s', animationDirection: 'reverse' }}></div>
                        <Sparkles className="w-14 h-14 text-purple-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                      </div>

                      {/* AI Status */}
                      <div className="text-center space-y-4">
                        <h3 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-clip-text text-transparent animate-pulse">
                          AI is Generating Questions
                        </h3>
                        <p className="text-lg text-muted-foreground max-w-md">
                          Analyzing document content and creating intelligent questions tailored to your material...
                        </p>
                        {selectedDocForGeneration && (
                          <div className="mt-8 p-6 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 dark:from-purple-950/30 dark:via-pink-950/20 dark:to-purple-950/30 rounded-2xl inline-block border-2 border-purple-200 dark:border-purple-800 shadow-lg">
                            <div className="flex items-center gap-3 mb-3">
                              <FileText className="w-6 h-6 text-purple-600" />
                              <p className="text-base font-bold text-purple-900 dark:text-purple-100">
                                {selectedDocForGeneration.title}
                              </p>
                            </div>
                            <div className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-200/50 dark:bg-purple-900/50 rounded-full">
                              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                                Generating {generationForm.num_short + generationForm.num_long + generationForm.num_mcq} Questions
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* AI Activity Indicator */}
                      <div className="flex items-center gap-4 mt-4">
                        <Cpu className="w-7 h-7 text-purple-500 animate-pulse" />
                        <div className="flex gap-2">
                          <div className="w-3 h-12 bg-gradient-to-t from-purple-500 to-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></div>
                          <div className="w-3 h-16 bg-gradient-to-t from-pink-500 to-pink-400 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-3 h-10 bg-gradient-to-t from-purple-500 to-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-3 h-14 bg-gradient-to-t from-pink-500 to-pink-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                          <div className="w-3 h-12 bg-gradient-to-t from-purple-500 to-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                          <div className="w-3 h-16 bg-gradient-to-t from-pink-500 to-pink-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                          <div className="w-3 h-10 bg-gradient-to-t from-purple-500 to-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                        </div>
                        <Sparkles className="w-7 h-7 text-pink-500 animate-pulse" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle className="text-2xl flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-purple-500" />
                        AI Question Generation
                      </DialogTitle>
                      <DialogDescription>
                        Generate questions from: <strong>{selectedDocForGeneration?.title}</strong>
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleGenerateQuestions} className="space-y-6">
                    <div className="space-y-4">
                      <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                          <div className="text-sm text-purple-700 dark:text-purple-300">
                            <p className="font-semibold mb-1">How it works:</p>
                            <ul className="list-disc list-inside space-y-1 text-purple-600 dark:text-purple-400">
                              <li>AI analyzes your document content</li>
                              <li>Questions are generated and saved as &quot;unreviewed&quot;</li>
                              <li>You review and approve before students see them</li>
                              <li>Maximum 100 total questions per generation</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="num-short" className="text-base font-semibold">
                          Short Answer Questions (1-2 sentences)
                        </Label>
                        <Input
                          id="num-short"
                          type="number"
                          min="0"
                          max="50"
                          value={generationForm.num_short}
                          onChange={(e) => setGenerationForm({ ...generationForm, num_short: parseInt(e.target.value) || 0 })}
                          className="text-base"
                        />
                        <p className="text-sm text-muted-foreground">
                          0-50 questions
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="num-long" className="text-base font-semibold">
                          Long Answer Questions (1-2 paragraphs)
                        </Label>
                        <Input
                          id="num-long"
                          type="number"
                          min="0"
                          max="50"
                          value={generationForm.num_long}
                          onChange={(e) => setGenerationForm({ ...generationForm, num_long: parseInt(e.target.value) || 0 })}
                          className="text-base"
                        />
                        <p className="text-sm text-muted-foreground">
                          0-50 questions
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="num-mcq" className="text-base font-semibold">
                          Multiple Choice Questions (4 options)
                        </Label>
                        <Input
                          id="num-mcq"
                          type="number"
                          min="0"
                          max="50"
                          value={generationForm.num_mcq}
                          onChange={(e) => setGenerationForm({ ...generationForm, num_mcq: parseInt(e.target.value) || 0 })}
                          className="text-base"
                        />
                        <p className="text-sm text-muted-foreground">
                          0-50 questions
                        </p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium">
                          Total questions: <span className="text-lg font-bold text-primary">
                            {generationForm.num_short + generationForm.num_long + generationForm.num_mcq}
                          </span>
                          <span className="text-muted-foreground ml-2">/ 100 max</span>
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsGenerateOpen(false);
                          setSelectedDocForGeneration(null);
                          setGenerationForm({ num_short: 0, num_long: 0, num_mcq: 0 });
                        }}
                        disabled={isGenerating}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isGenerating || (generationForm.num_short + generationForm.num_long + generationForm.num_mcq === 0)}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Questions
                      </Button>
                    </DialogFooter>
                    </form>
                  </>
                )}
              </DialogContent>
            </Dialog>

            {/* Delete Testbank Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Testbank</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <p>
                      You are about to delete the testbank: <strong>{documentToDelete?.title || documentToDelete?.file_name}</strong>
                    </p>
                    <p className="text-sm">
                      Would you like to also delete all the questions generated from this testbank?
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel
                    onClick={() => {
                      setDeleteDialogOpen(false);
                      setDocumentToDelete(null);
                    }}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <Button
                    variant="outline"
                    onClick={() => executeDelete(documentToDelete?.id, false)}
                    className="sm:flex-1"
                  >
                    <FileCheck className="w-4 h-4 mr-2" />
                    Keep Questions
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => executeDelete(documentToDelete?.id, true)}
                    className="sm:flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <DocumentsContent />
    </Suspense>
  );
}