'use client';

import { Suspense, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const AlertDialog = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialog })), { ssr: false });
const AlertDialogCancel = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogCancel })), { ssr: false });
const AlertDialogContent = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogContent })), { ssr: false });
const AlertDialogDescription = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogDescription })), { ssr: false });
const AlertDialogFooter = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogFooter })), { ssr: false });
const AlertDialogHeader = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogHeader })), { ssr: false });
const AlertDialogTitle = dynamic(() => import("@/components/ui/alert-dialog").then(mod => ({ default: mod.AlertDialogTitle })), { ssr: false });

import {
  Upload, FolderOpen, File, FileText, FileVideo, Image as ImageIcon,
  Archive, Edit3, Trash2, Download, Search, FileCheck,
  CheckCircle2, Loader2, AlertCircle, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/auth";

function DocumentsContent() {
  const { user, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const moduleName = searchParams.get("module");
  const moduleIdFromParam = searchParams.get("moduleId");

  const [documents, setDocuments] = useState([]);
  const [currentModule, setCurrentModule] = useState(null);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [, setAvailableModules] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
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
      if (!userId) { setIsLoadingDocuments(false); return; }
      if (moduleIdFromParam) {
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

  useEffect(() => {
    if (isAuthenticated && (user?.id || user?.sub) && moduleName) {
      fetchModuleAndDocuments();
    }
  }, [isAuthenticated, user?.id, user?.sub, moduleName, fetchModuleAndDocuments]);

  useEffect(() => {
    if (!isUploadOpen) { setUploadForm({ title: "", file: null }); setIsTestbank(false); }
  }, [isUploadOpen]);

  useEffect(() => {
    if (isUploading) {
      setUploadStage(0);
      const stages = isTestbank ? [0, 1, 2, 3] : [0, 1, 2];
      let idx = 0;
      const interval = setInterval(() => {
        idx = (idx + 1) % stages.length;
        setUploadStage(stages[idx]);
      }, isTestbank ? 2500 : 2000);
      return () => clearInterval(interval);
    }
  }, [isUploading, isTestbank]);

  const formatFileSize = (bytes) => {
    if (!bytes) return '—';
    const kb = bytes / 1024;
    return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const FILE_CONFIG = {
    pdf:  { bg: 'bg-red-50 dark:bg-red-950/30',    icon: <FileText className="w-5 h-5 text-red-500" />,    dot: 'bg-red-400',    label: 'PDF' },
    docx: { bg: 'bg-blue-50 dark:bg-blue-950/30',   icon: <File className="w-5 h-5 text-blue-500" />,      dot: 'bg-blue-400',   label: 'DOCX' },
    doc:  { bg: 'bg-blue-50 dark:bg-blue-950/30',   icon: <File className="w-5 h-5 text-blue-500" />,      dot: 'bg-blue-400',   label: 'DOC' },
    pptx: { bg: 'bg-orange-50 dark:bg-orange-950/30', icon: <FileVideo className="w-5 h-5 text-orange-500" />, dot: 'bg-orange-400', label: 'PPTX' },
    ppt:  { bg: 'bg-orange-50 dark:bg-orange-950/30', icon: <FileVideo className="w-5 h-5 text-orange-500" />, dot: 'bg-orange-400', label: 'PPT' },
    jpg:  { bg: 'bg-green-50 dark:bg-green-950/30', icon: <ImageIcon className="w-5 h-5 text-green-500" />, dot: 'bg-green-400',  label: 'JPG' },
    jpeg: { bg: 'bg-green-50 dark:bg-green-950/30', icon: <ImageIcon className="w-5 h-5 text-green-500" />, dot: 'bg-green-400',  label: 'JPEG' },
    png:  { bg: 'bg-green-50 dark:bg-green-950/30', icon: <ImageIcon className="w-5 h-5 text-green-500" />, dot: 'bg-green-400',  label: 'PNG' },
    zip:  { bg: 'bg-violet-50 dark:bg-violet-950/30', icon: <Archive className="w-5 h-5 text-violet-500" />, dot: 'bg-violet-400', label: 'ZIP' },
  };

  const getFileConfig = (type) => FILE_CONFIG[type?.toLowerCase()] || {
    bg: 'bg-muted', icon: <FileText className="w-5 h-5 text-muted-foreground" />, dot: 'bg-muted-foreground', label: (type || 'FILE').toUpperCase()
  };

  const STATUS_CONFIG = {
    embedded: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', ring: 'ring-emerald-200 dark:ring-emerald-800', label: 'Embedded', spin: false },
    indexed:  { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', ring: 'ring-emerald-200 dark:ring-emerald-800', label: 'Embedded', spin: false },
    chunked:  { dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', ring: 'ring-blue-200 dark:ring-blue-800', label: 'Processed', spin: false },
    extracted:{ dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', ring: 'ring-blue-200 dark:ring-blue-800', label: 'Processed', spin: false },
    extracting:{ dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', ring: 'ring-amber-200 dark:ring-amber-800', label: 'Processing', spin: true },
    chunking: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', ring: 'ring-amber-200 dark:ring-amber-800', label: 'Processing', spin: true },
    embedding:{ dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', ring: 'ring-amber-200 dark:ring-amber-800', label: 'Processing', spin: true },
    failed:   { dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', ring: 'ring-red-200 dark:ring-red-800', label: 'Failed', spin: false },
  };

  const getStatusBadge = (processingStatus) => {
    const cfg = STATUS_CONFIG[processingStatus?.toLowerCase()] || {
      dot: 'bg-muted-foreground/50', text: 'text-muted-foreground', bg: 'bg-muted/50', ring: 'ring-border', label: 'Uploaded', spin: false
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
        {cfg.spin
          ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
          : <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`} />
        }
        {cfg.label}
      </span>
    );
  };

  const getStatusStats = () => {
    const s = { embedded: 0, processed: 0, processing: 0, failed: 0, uploaded: 0 };
    documents.forEach(doc => {
      const st = doc.processing_status?.toLowerCase() || 'uploaded';
      if (st === 'embedded' || st === 'indexed') s.embedded++;
      else if (st === 'chunked' || st === 'extracted') s.processed++;
      else if (st === 'extracting' || st === 'chunking' || st === 'embedding') s.processing++;
      else if (st === 'failed') s.failed++;
      else s.uploaded++;
    });
    return s;
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase());
    if (typeFilter === "testbank" && !doc.is_testbank) return false;
    if (typeFilter === "regular" && doc.is_testbank) return false;
    if (statusFilter === "all") return matchesSearch;
    const st = doc.processing_status?.toLowerCase() || 'uploaded';
    if (statusFilter === "embedded") return matchesSearch && (st === 'embedded' || st === 'indexed');
    if (statusFilter === "processed") return matchesSearch && (st === 'chunked' || st === 'extracted');
    if (statusFilter === "processing") return matchesSearch && (st === 'extracting' || st === 'chunking' || st === 'embedding');
    if (statusFilter === "failed") return matchesSearch && st === 'failed';
    if (statusFilter === "uploaded") return matchesSearch && st === 'uploaded';
    return matchesSearch;
  });

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.file) { alert("Please select a file to upload"); return; }
    if (!currentModule) { alert("Module not found. Please refresh the page and try again."); return; }
    const userId = user?.id || user?.sub;
    if (!userId) { alert("User session error. Please refresh the page and try again."); return; }
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
        const err = await response.json().catch(() => ({}));
        alert(err.detail || `Upload failed: ${response.statusText}`);
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
      const updatedDoc = await apiClient.put(`/api/documents/${selectedDocument.id}`, { title: uploadForm.title });
      setDocuments(docs => docs.map(d => d.id === selectedDocument.id ? updatedDoc : d));
      setIsEditOpen(false);
      setSelectedDocument(null);
    } catch (error) {
      console.error("Edit error:", error);
      alert("Failed to update document. Please try again.");
    }
  };

  const handleDelete = (doc) => {
    if (doc.is_testbank) { setDocumentToDelete(doc); setDeleteDialogOpen(true); }
    else { if (!confirm("Are you sure you want to delete this document?")) return; executeDelete(doc.id, false); }
  };

  const executeDelete = async (id, deleteQuestions) => {
    try {
      setIsDeleting(id);
      setDeleteDialogOpen(false);
      await apiClient.delete(deleteQuestions ? `/api/documents/${id}?delete_questions=true` : `/api/documents/${id}`);
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
    if (total === 0) { alert("Please specify at least one question to generate"); return; }
    if (total > 100) { alert("Cannot generate more than 100 questions at once"); return; }
    try {
      setIsGenerating(true);
      const response = await apiClient.post(`/api/documents/${selectedDocForGeneration.id}/generate-questions`, generationForm);
      setIsGenerateOpen(false);
      setSelectedDocForGeneration(null);
      setGenerationForm({ num_short: 0, num_long: 0, num_mcq: 0 });
      alert(`Successfully generated ${response.generated_count} questions! Redirecting to review page...`);
      window.location.href = response.review_url;
    } catch (error) {
      console.error("Generate error:", error);
      alert(error.response?.data?.detail || "Failed to generate questions. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoadingDocuments && documents.length === 0) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!isAuthenticated) return (
    <SidebarProvider><AppSidebar variant="inset" /><SidebarInset><SiteHeader />
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <div className="w-10 h-10 mx-auto mb-3 bg-red-50 dark:bg-red-950/30 rounded-xl flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="font-medium mb-1">Access Denied</p>
          <p className="text-sm text-muted-foreground mb-4">Sign in to manage your documents.</p>
          <Button asChild size="sm"><Link href="/sign-in">Sign In</Link></Button>
        </div>
      </div>
    </SidebarInset></SidebarProvider>
  );

  if (!moduleName) return (
    <SidebarProvider><AppSidebar variant="inset" /><SidebarInset><SiteHeader />
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <div className="w-10 h-10 mx-auto mb-3 bg-muted rounded-xl flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="font-medium mb-1">No Module Selected</p>
          <p className="text-sm text-muted-foreground mb-4">Select a module to view its documents.</p>
          <Button asChild size="sm"><Link href="/mymodules">Go to My Modules</Link></Button>
        </div>
      </div>
    </SidebarInset></SidebarProvider>
  );

  if (!isLoadingDocuments && !currentModule && moduleName) return (
    <SidebarProvider><AppSidebar variant="inset" /><SidebarInset><SiteHeader />
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <div className="w-10 h-10 mx-auto mb-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <p className="font-medium mb-1">Module Not Found</p>
          <p className="text-sm text-muted-foreground mb-4">The module &quot;{moduleName}&quot; does not exist.</p>
          <Button asChild size="sm"><Link href="/mymodules">View All Modules</Link></Button>
        </div>
      </div>
    </SidebarInset></SidebarProvider>
  );

  const totalSize = documents.reduce((acc, doc) => acc + (doc.file_size || 0), 0);
  const statusStats = getStatusStats();
  const testbankCount = documents.filter(d => d.is_testbank).length;

  const uploadStageLabels = isTestbank
    ? ['Uploading', 'Extracting', 'Parsing', 'Saving']
    : ['Uploading', 'Extracting', 'Embedding'];

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="min-h-screen bg-background">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Document Library</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {currentModule?.name || moduleName} · {documents.length} document{documents.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="self-start sm:self-auto gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    Upload
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  {isUploading ? (
                    <div className="py-10 flex flex-col items-center gap-6">
                      <div className="relative w-16 h-16">
                        <div className="w-16 h-16 border-4 border-muted rounded-full" />
                        <div className={`w-16 h-16 border-4 border-t-transparent rounded-full animate-spin absolute top-0 ${isTestbank ? 'border-violet-500' : 'border-primary'}`} />
                        {isTestbank
                          ? <Sparkles className="w-6 h-6 text-violet-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                          : <Upload className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        }
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{uploadStageLabels[uploadStage]}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Step {uploadStage + 1} of {uploadStageLabels.length}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {uploadStageLabels.map((step, i) => (
                          <div key={step} className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                              uploadStage > i ? 'bg-emerald-500 text-white' :
                              uploadStage === i ? (isTestbank ? 'bg-violet-500' : 'bg-primary') + ' text-white' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {uploadStage > i ? '✓' : i + 1}
                            </div>
                            {i < uploadStageLabels.length - 1 && (
                              <div className={`w-6 h-px ${uploadStage > i ? 'bg-emerald-500' : 'bg-muted'}`} />
                            )}
                          </div>
                        ))}
                      </div>
                      {uploadForm.file && (
                        <div className="w-full p-3 bg-muted/50 rounded-lg border flex items-center gap-2 text-sm">
                          <FileCheck className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate font-medium">{uploadForm.file.name}</span>
                          <span className="text-muted-foreground ml-auto text-xs flex-shrink-0">{formatFileSize(uploadForm.file.size)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <DialogHeader>
                        <DialogTitle>Upload Document</DialogTitle>
                        <DialogDescription>Add course materials or a testbank to this module</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleUpload} className="space-y-4 mt-1">
                        <div className="space-y-1.5">
                          <Label htmlFor="file" className="text-sm">File</Label>
                          <Input id="file" type="file" onChange={(e) => {
                            const f = e.target.files[0];
                            setUploadForm({ ...uploadForm, file: f });
                            if (f) setIsTestbank(f.name.toLowerCase().includes('testbank'));
                          }} required />
                          {uploadForm.file && (
                            <div className="p-2.5 bg-muted/50 rounded-lg border text-sm">
                              <div className="flex items-center gap-2">
                                <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="font-medium truncate">{uploadForm.file.name}</span>
                                <span className="text-muted-foreground text-xs ml-auto">{formatFileSize(uploadForm.file.size)}</span>
                              </div>
                              {isTestbank && (
                                <p className="mt-1.5 text-xs text-violet-600 dark:text-violet-400 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  Testbank detected — questions will be auto-extracted
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="title" className="text-sm">
                            Title <span className="text-muted-foreground font-normal">(optional)</span>
                          </Label>
                          <Input id="title" value={uploadForm.title}
                            onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                            placeholder="Defaults to filename" />
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" size="sm" onClick={() => setIsUploadOpen(false)}>Cancel</Button>
                          <Button type="submit" size="sm" disabled={!uploadForm.file}>
                            <Upload className="w-3.5 h-3.5 mr-1.5" />Upload
                          </Button>
                        </DialogFooter>
                      </form>
                    </>
                  )}
                </DialogContent>
              </Dialog>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total', value: documents.length, sub: formatFileSize(totalSize), icon: <FileText className="w-4 h-4 text-muted-foreground" /> },
                { label: 'Embedded', value: statusStats.embedded, sub: `${statusStats.processed} processed`, icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> },
                { label: 'PDFs', value: documents.filter(d => d.file_type?.toLowerCase() === 'pdf').length, sub: 'PDF files', icon: <FileText className="w-4 h-4 text-red-400" /> },
                { label: 'Testbanks', value: testbankCount, sub: 'Auto-parsed', icon: <Sparkles className="w-4 h-4 text-violet-400" /> },
              ].map(({ label, value, sub, icon }) => (
                <div key={label} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground font-medium">{label}</span>
                    {icon}
                  </div>
                  <span className="text-2xl font-bold tracking-tight">{isLoadingDocuments ? '—' : value}</span>
                  <span className="text-[11px] text-muted-foreground">{sub}</span>
                </div>
              ))}
            </div>

            {/* Search & filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search documents…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {/* Type pills */}
                {[
                  { key: 'all', label: 'All' },
                  { key: 'regular', label: 'Documents' },
                  { key: 'testbank', label: `Testbanks${testbankCount > 0 ? ` (${testbankCount})` : ''}` },
                ].map(t => (
                  <button key={t.key} onClick={() => setTypeFilter(t.key)}
                    className={`h-9 px-3 text-xs font-medium rounded-lg border transition-colors ${
                      typeFilter === t.key
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted'
                    }`}>
                    {t.label}
                  </button>
                ))}
                {/* Status pills */}
                {[
                  { key: 'all', label: 'Any' },
                  { key: 'embedded', label: 'Embedded' },
                  { key: 'processing', label: 'Processing' },
                  ...(statusStats.failed > 0 ? [{ key: 'failed', label: 'Failed' }] : []),
                ].map(s => (
                  <button key={s.key} onClick={() => setStatusFilter(s.key)}
                    className={`h-9 px-3 text-xs font-medium rounded-lg border transition-colors ${
                      statusFilter === s.key
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Document list */}
            {isLoadingDocuments ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-[72px] bg-card border border-border rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-xl py-16 text-center">
                <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-3">
                  <FolderOpen className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-sm mb-1">
                  {searchTerm ? `No results for "${searchTerm}"` : 'No documents yet'}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm ? 'Try a different search term' : 'Upload your first document to get started'}
                </p>
                {searchTerm
                  ? <Button variant="outline" size="sm" onClick={() => setSearchTerm('')}>Clear search</Button>
                  : <Button size="sm" onClick={() => setIsUploadOpen(true)}><Upload className="w-3.5 h-3.5 mr-1.5" />Upload Document</Button>
                }
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocuments.map((doc) => {
                  const cfg = getFileConfig(doc.file_type);
                  const isEmbedded = doc.processing_status === 'embedded' || doc.processing_status === 'indexed';
                  return (
                    <div
                      key={doc.id}
                      className="group flex items-center gap-3 sm:gap-4 bg-card border border-border rounded-xl px-4 py-3.5 hover:border-border/80 hover:shadow-sm transition-all"
                    >
                      {/* File type icon */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                        {cfg.icon}
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium truncate leading-snug">
                            {doc.title}
                          </p>
                          {doc.is_testbank && (
                            <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                              <Sparkles className="w-2.5 h-2.5" />TB
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className={`inline-flex items-center gap-1 font-medium`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                          {doc.file_size && <><span>·</span><span>{formatFileSize(doc.file_size)}</span></>}
                          {doc.created_at && <><span>·</span><span className="hidden sm:inline">{formatDate(doc.created_at)}</span></>}
                        </div>
                      </div>

                      {/* Status */}
                      <div className="hidden sm:block flex-shrink-0">
                        {getStatusBadge(doc.processing_status)}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        {isEmbedded && (
                          <button
                            onClick={() => { setSelectedDocForGeneration(doc); setGenerationForm({ num_short: 0, num_long: 0, num_mcq: 0 }); setIsGenerateOpen(true); }}
                            title="Generate Questions"
                            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Generate</span>
                          </button>
                        )}
                        <button
                          onClick={() => { const u = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"; window.open(`${u}/api/documents/${doc.id}/download`, '_blank'); }}
                          title="Download"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setSelectedDocument(doc); setUploadForm({ title: doc.title, file: null }); setIsEditOpen(true); }}
                          title="Rename"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc)}
                          disabled={isDeleting === doc.id}
                          title="Delete"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40"
                        >
                          {isDeleting === doc.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </button>
                      </div>
                    </div>
                  );
                })}
                <p className="text-center text-xs text-muted-foreground pt-1">
                  {filteredDocuments.length} of {documents.length} document{documents.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Rename Document</DialogTitle>
              <DialogDescription>Change the display title for this document</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4 mt-1">
              <div className="space-y-1.5">
                <Label htmlFor="edit-title" className="text-sm">Title</Label>
                <Input id="edit-title" value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  placeholder="Document title" required />
              </div>
              {selectedDocument && (
                <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/40 rounded-lg">
                  <div className="flex justify-between"><span>File</span><span className="text-foreground font-medium">{selectedDocument.file_name}</span></div>
                  <div className="flex justify-between"><span>Size</span><span className="text-foreground">{formatFileSize(selectedDocument.file_size)}</span></div>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm"><FileCheck className="w-3.5 h-3.5 mr-1.5" />Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* AI Generate Dialog */}
        <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
          <DialogContent className="max-w-md">
            {isGenerating ? (
              <div className="py-10 flex flex-col items-center gap-5">
                <div className="relative w-16 h-16">
                  <div className="w-16 h-16 border-4 border-muted rounded-full" />
                  <div className="w-16 h-16 border-4 border-t-transparent border-violet-500 rounded-full animate-spin absolute top-0" />
                  <Sparkles className="w-6 h-6 text-violet-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Generating Questions</p>
                  <p className="text-sm text-muted-foreground mt-0.5">AI is analyzing your document…</p>
                </div>
                {selectedDocForGeneration && (
                  <div className="w-full p-3 bg-muted/40 rounded-lg border text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{selectedDocForGeneration.title}</span>
                    <span className="ml-auto text-muted-foreground text-xs font-semibold flex-shrink-0">
                      {generationForm.num_short + generationForm.num_long + generationForm.num_mcq}q
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    Generate Questions
                  </DialogTitle>
                  <DialogDescription>From: <strong>{selectedDocForGeneration?.title}</strong></DialogDescription>
                </DialogHeader>
                <form onSubmit={handleGenerateQuestions} className="space-y-4 mt-2">
                  <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground">
                    Questions are saved as &quot;unreviewed&quot; — you approve them before students see them. Max 100 per generation.
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "num-short", key: "num_short", label: "Short" },
                      { id: "num-long", key: "num_long", label: "Long" },
                      { id: "num-mcq", key: "num_mcq", label: "MCQ" },
                    ].map(({ id, key, label }) => (
                      <div key={key} className="space-y-1">
                        <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
                        <Input id={id} type="number" min="0" max="50"
                          value={generationForm[key]}
                          onChange={(e) => setGenerationForm({ ...generationForm, [key]: parseInt(e.target.value) || 0 })}
                          className="h-9 text-center text-base font-semibold" />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-lg text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-bold">
                      {generationForm.num_short + generationForm.num_long + generationForm.num_mcq}
                      <span className="font-normal text-muted-foreground text-xs"> / 100</span>
                    </span>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" size="sm" onClick={() => { setIsGenerateOpen(false); setSelectedDocForGeneration(null); setGenerationForm({ num_short: 0, num_long: 0, num_mcq: 0 }); }}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm"
                      disabled={generationForm.num_short + generationForm.num_long + generationForm.num_mcq === 0}
                      className="bg-violet-600 hover:bg-violet-700 text-white">
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Testbank Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Testbank</AlertDialogTitle>
              <AlertDialogDescription className="space-y-1.5">
                <span>Deleting <strong>{documentToDelete?.title || documentToDelete?.file_name}</strong>.</span>
                <span className="block text-sm">Also delete all questions generated from this testbank?</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel onClick={() => { setDeleteDialogOpen(false); setDocumentToDelete(null); }}>
                Cancel
              </AlertDialogCancel>
              <Button variant="outline" size="sm" onClick={() => executeDelete(documentToDelete?.id, false)}>
                <FileCheck className="w-3.5 h-3.5 mr-1.5" />Keep Questions
              </Button>
              <Button variant="destructive" size="sm" onClick={() => executeDelete(documentToDelete?.id, true)}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete All
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </SidebarInset>
    </SidebarProvider>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    }>
      <DocumentsContent />
    </Suspense>
  );
}
