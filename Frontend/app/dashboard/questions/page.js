'use client';

import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";
import dynamic from 'next/dynamic';
import NextImage from 'next/image';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  HelpCircle,
  Plus,
  Search,
  Edit3,
  Trash2,
  BookOpen,
  CheckCircle,
  FileText,
  MessageCircle,
  AlignLeft,
  Target,
  Brain,
  Image,
  Sparkles,
  AlertCircle,
  ArrowRight,
  Trophy,
  Upload,
  Download,
  FileCheck,
  Cpu,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { useState, useEffect, Suspense, useCallback, useMemo, memo } from "react";
import { apiClient } from "@/lib/auth";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const QuestionsPageContent = memo(function QuestionsPageContent() {
  const { user, loading, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const moduleName = searchParams.get('module');

  console.log('🟢 QuestionsPageContent mounted/rendered', {
    moduleName,
    isAuthenticated,
    userId: user?.id || user?.sub,
    userObject: user,
    loading
  });

  const [questions, setQuestions] = useState([]);
  const [currentModule, setCurrentModule] = useState(null);
  const [moduleDocument, setModuleDocument] = useState(null);
  const [unreviewedCount, setUnreviewedCount] = useState(0);
  const [moduleRubric, setModuleRubric] = useState(null);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isTestbank, setIsTestbank] = useState(false);
  const [uploadStage, setUploadStage] = useState(0);
  const [uploadForm, setUploadForm] = useState({ title: "", file: null });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [questionForm, setQuestionForm] = useState({
    type: "mcq",
    text: "",
    slide_number: "",
    points: "1.0",
    options: ["", "", "", ""],
    correct_answer: "",
    correct_option_id: "",
    learning_outcome: "",
    bloom_taxonomy: "",
    image_url: "",
    has_text_input: false,
    allow_critique: false, // Allow students to critique AI feedback (disabled by default)
    // New question types fields
    extended_config: null,
    // Fill-in-the-blank specific
    blanks: [],
    // MCQ Multiple specific
    correct_option_ids: [],
    partial_credit: true,
    penalty_for_wrong: true,
    // Multi-part specific
    sub_questions: []
  });

  useEffect(() => {
    // Wait for auth to finish loading before fetching
    if (loading) {
      console.log('⏳ Auth still loading, waiting...');
      return;
    }

    if (!isAuthenticated) {
      console.log('❌ Not authenticated');
      setLoadingQuestions(false);
      return;
    }

    const userId = user?.id || user?.sub;
    if (!user || !userId) {
      console.log('❌ User not loaded yet', { user, userId, loading });
      setLoadingQuestions(false);
      return;
    }

    if (!moduleName) {
      console.log('❌ No module name in URL');
      setLoadingQuestions(false);
      return;
    }

    console.log('✅ All conditions met, fetching module and questions');
    fetchModuleAndQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, moduleName, loading]);

  const fetchModuleAndQuestions = async () => {
    setLoadingQuestions(true);
    try {
      // Get module info
      const userId = user?.id || user?.sub;
      console.log('Fetching modules for teacher:', userId, 'Full user object:', user);

      if (!user || !userId) {
        console.error('❌ User is not loaded! Cannot fetch modules.', { user, isAuthenticated, loading });
        setLoadingQuestions(false);
        return;
      }

      const moduleData = await apiClient.get(`/api/modules?teacher_id=${userId}`);
      console.log('Module data received:', moduleData);
      console.log('Available module names:', moduleData.map(m => m.name));
      console.log('Looking for module with name:', moduleName);

      const foundModule = moduleData.find(m => m.name === moduleName);
      console.log('Found module:', foundModule, 'for name:', moduleName);

      if (!foundModule) {
        console.error('❌ Module not found!');
        console.error('Available modules:', moduleData.map(m => ({ id: m.id, name: m.name })));
        console.error('Searched for:', moduleName);
      }

      if (foundModule) {
        console.log('Setting current module:', foundModule);
        setCurrentModule(foundModule);

        // Get documents for this module to use as question container
        const documentsData = await apiClient.get(`/api/documents?teacher_id=${userId}&module_id=${foundModule.id}`);
        
        // Use the first document as container, or create a placeholder if none exist
        if (documentsData && documentsData.length > 0) {
          setModuleDocument(documentsData[0]);
        } else {
          // Create a virtual document object for modules without documents
          console.log('No documents found, creating virtual document');
          setModuleDocument({
            id: `virtual-${foundModule.id}`,
            title: `${foundModule.name} - Questions`,
            module_id: foundModule.id
          });
        }

        // Fetch questions for this module (only active questions, not unreviewed)
        console.log('Fetching questions for module:', foundModule.id);
        const questionsData = await apiClient.get(`/api/questions/by-module?module_id=${foundModule.id}&status=active`);
        console.log('Questions data received:', questionsData);
        setQuestions(questionsData || []);

        // Fetch unreviewed questions count
        try {
          const unreviewedData = await apiClient.get(`/api/questions/by-module?module_id=${foundModule.id}&status=unreviewed`);
          setUnreviewedCount(unreviewedData?.length || 0);
        } catch (error) {
          console.error('Failed to fetch unreviewed count:', error);
          setUnreviewedCount(0);
        }

        // Fetch rubric settings for default points
        try {
          const rubricData = await apiClient.get(`/api/modules/${foundModule.id}/rubric`);
          setModuleRubric(rubricData.rubric);
        } catch (error) {
          console.error('Failed to fetch rubric:', error);
          setModuleRubric(null);
        }
      } else {
        console.log('Module not found for name:', moduleName, 'in modules:', moduleData);
      }
    } catch (error) {
      console.error('Failed to fetch module or questions:', error);
      console.error('Error details:', error.response?.data || error.message);
      setQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Reset import form when dialog closes
  useEffect(() => {
    if (!isImportOpen) {
      setUploadForm({ title: "", file: null });
      setIsTestbank(false);
    }
  }, [isImportOpen]);

  // Cycle through upload stages during import
  useEffect(() => {
    if (isUploading) {
      setUploadStage(0);
      const stages = isTestbank ? [0, 1, 2, 3] : [0, 1, 2];
      let currentStageIndex = 0;
      const interval = setInterval(() => {
        currentStageIndex = (currentStageIndex + 1) % stages.length;
        setUploadStage(stages[currentStageIndex]);
      }, isTestbank ? 2500 : 2000);
      return () => clearInterval(interval);
    }
  }, [isUploading, isTestbank]);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const handleImport = async (e) => {
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
        setUploadForm({ title: "", file: null });
        setIsImportOpen(false);
        // Refresh questions list (relevant for testbank uploads)
        await fetchModuleAndQuestions();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.detail || `Upload failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Import error:", error);
      alert("Upload failed. Please check your connection and try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleExport = () => {
    if (questions.length === 0) {
      alert("No questions to export.");
      return;
    }
    const exportData = questions.map(q => ({
      type: q.type,
      text: q.text,
      points: q.points,
      options: q.options,
      correct_option_id: q.correct_option_id,
      correct_answer: q.correct_answer,
      extended_config: q.extended_config,
      learning_outcome: q.learning_outcome,
      bloom_taxonomy: q.bloom_taxonomy,
      slide_number: q.slide_number,
      image_url: q.image_url,
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${moduleName}-questions.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper function to get default points from rubric
  const getDefaultPoints = (questionType) => {
    if (!moduleRubric || !moduleRubric.question_type_settings) {
      return 1.0; // Fallback default
    }

    const typeSettings = moduleRubric.question_type_settings[questionType];
    return typeSettings?.default_points || 1.0;
  };

  const getQuestionIcon = (type) => {
    switch (type) {
      case 'mcq':
        return <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'mcq_multiple':
        return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'fill_blank':
        return <FileText className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />;
      case 'multi_part':
        return <AlignLeft className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
      case 'short':
        return <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'long':
        return <AlignLeft className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      default:
        return <HelpCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getQuestionTypeBadge = (type) => {
    switch (type) {
      case 'mcq':
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-0";
      case 'mcq_multiple':
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-0";
      case 'fill_blank':
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-0";
      case 'multi_part':
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-0";
      case 'short':
        return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300 border-0";
      case 'long':
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border-0";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-0";
    }
  };

  const getQuestionTypeLabel = (type) => {
    switch (type) {
      case 'mcq':
        return "MCQ";
      case 'mcq_multiple':
        return "MCQ Multiple";
      case 'fill_blank':
        return "Fill Blanks";
      case 'multi_part':
        return "Multi-Part";
      case 'short':
        return "Short";
      case 'long':
        return "Long";
      default:
        return type.toUpperCase();
    }
  };

  const filteredQuestions = questions.filter(question => {
    const matchesSearch = question.text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || question.type === filterType;
    return matchesSearch && matchesType;
  });

  const resetForm = () => {
    const defaultType = "mcq";
    setQuestionForm({
      type: defaultType,
      text: "",
      slide_number: "",
      points: getDefaultPoints(defaultType).toString(),
      options: ["", "", "", ""],
      correct_answer: "",
      correct_option_id: "",
      learning_outcome: "",
      bloom_taxonomy: "",
      image_url: "",
      has_text_input: false,
      allow_critique: false,
      extended_config: null,
      blanks: [],
      correct_option_ids: [],
      partial_credit: true,
      penalty_for_wrong: true,
      sub_questions: []
    });
  };

  const handleCreate = async (e) => {
    console.log('🔵 handleCreate called!', { e, questionForm, currentModule, moduleName });
    e.preventDefault();

    // Better validation with user feedback
    if (!questionForm.text) {
      alert('Please enter a question text');
      console.error('Validation failed: questionForm.text is empty');
      return;
    }

    if (!currentModule) {
      alert('Module not loaded. Please refresh the page and try again.');
      console.error('Validation failed: currentModule is null', { moduleName });
      return;
    }

    // Validate question type specific requirements
    if (questionForm.type === "mcq" || questionForm.type === "mcq_multiple") {
      const filledOptions = questionForm.options.filter(opt => opt.trim()).length;
      if (filledOptions < 2) {
        alert('Please provide at least 2 options for the MCQ question');
        console.error('Validation failed: MCQ question has less than 2 options', { filledOptions });
        return;
      }
    }

    if (questionForm.type === "mcq" && !questionForm.correct_option_id) {
      alert('Please select a correct answer for the MCQ question');
      console.error('Validation failed: MCQ question missing correct_option_id');
      return;
    }

    if (questionForm.type === "mcq_multiple" && (!questionForm.correct_option_ids || questionForm.correct_option_ids.length === 0)) {
      alert('Please select at least one correct answer for the multiple choice question');
      console.error('Validation failed: MCQ multiple question missing correct_option_ids');
      return;
    }

    try {
      // Use existing document_id if available, or null if creating standalone questions
      const documentId = (moduleDocument?.id && !moduleDocument.id.startsWith('virtual-'))
        ? moduleDocument.id
        : null;

      // Build extended_config based on question type
      let extended_config = null;
      let options = null;
      let correct_option_id = null;
      let correct_answer = null;

      if (questionForm.type === "mcq") {
        options = questionForm.options
          .filter(opt => opt.trim())
          .reduce((acc, opt, index) => ({
            ...acc,
            [String.fromCharCode(65 + index)]: opt
          }), {});
        correct_option_id = questionForm.correct_option_id;
      } else if (questionForm.type === "mcq_multiple") {
        options = questionForm.options
          .filter(opt => opt.trim())
          .reduce((acc, opt, index) => ({
            ...acc,
            [String.fromCharCode(65 + index)]: opt
          }), {});
        extended_config = {
          correct_option_ids: questionForm.correct_option_ids,
          partial_credit: questionForm.partial_credit,
          penalty_for_wrong: questionForm.penalty_for_wrong
        };
      } else if (questionForm.type === "fill_blank") {
        extended_config = {
          blanks: questionForm.blanks,
          allow_partial_credit: true
        };
      } else if (questionForm.type === "multi_part") {
        extended_config = {
          sub_questions: questionForm.sub_questions
        };
      } else {
        // For short/long text questions
        correct_answer = questionForm.correct_answer;
      }

      const payload = {
        module_id: currentModule.id,
        document_id: documentId,
        type: questionForm.type,
        text: questionForm.text,
        slide_number: questionForm.slide_number ? parseInt(questionForm.slide_number) : null,
        points: questionForm.points ? parseFloat(questionForm.points) : 1.0,
        options: options,
        correct_option_id: correct_option_id,
        correct_answer: correct_answer,
        extended_config: extended_config,
        learning_outcome: questionForm.learning_outcome || null,
        bloom_taxonomy: questionForm.bloom_taxonomy || null,
        image_url: questionForm.image_url || null,
        has_text_input: questionForm.has_text_input,
        allow_critique: questionForm.allow_critique === true, // Default to false
        status: 'active',
        is_ai_generated: false
      };

      console.log('📝 Creating question with payload:', payload);
      const response = await apiClient.post('/api/questions', payload);
      console.log('✅ Question created with ID:', response.id);

      // Upload image if one was selected
      if (selectedImageFile) {
        console.log('📷 Question created, now uploading image...');
        const imageUrl = await handleImageUpload(response.id);

        if (imageUrl) {
          console.log('✅ Image uploaded successfully:', imageUrl);
          response.image_url = imageUrl;
        } else {
          console.warn('⚠️ Image upload returned null');
        }
      } else {
        console.log('ℹ️ No image selected for this question');
      }

      setQuestions([...questions, response]);
      resetForm();
      clearImageSelection();
      setShowCreateForm(false);
      console.log('✅ Question creation complete!');
    } catch (error) {
      console.error('❌ Create error:', error);
      alert(`Failed to create question: ${error.message}\n\nPlease check the console for details.`);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!selectedQuestion || !questionForm.text) return;

    try {
      // Build extended_config based on question type (same as create)
      let extended_config = null;
      let options = null;
      let correct_option_id = null;
      let correct_answer = null;

      if (questionForm.type === "mcq") {
        options = questionForm.options
          .filter(opt => opt.trim())
          .reduce((acc, opt, index) => ({
            ...acc,
            [String.fromCharCode(65 + index)]: opt
          }), {});
        correct_option_id = questionForm.correct_option_id;
      } else if (questionForm.type === "mcq_multiple") {
        options = questionForm.options
          .filter(opt => opt.trim())
          .reduce((acc, opt, index) => ({
            ...acc,
            [String.fromCharCode(65 + index)]: opt
          }), {});
        extended_config = {
          correct_option_ids: questionForm.correct_option_ids,
          partial_credit: questionForm.partial_credit,
          penalty_for_wrong: questionForm.penalty_for_wrong
        };
      } else if (questionForm.type === "fill_blank") {
        extended_config = {
          blanks: questionForm.blanks,
          allow_partial_credit: true
        };
      } else if (questionForm.type === "multi_part") {
        extended_config = {
          sub_questions: questionForm.sub_questions
        };
      } else {
        correct_answer = questionForm.correct_answer;
      }

      const payload = {
        document_id: selectedQuestion.document_id,
        type: questionForm.type,
        text: questionForm.text,
        slide_number: questionForm.slide_number ? parseInt(questionForm.slide_number) : null,
        points: questionForm.points ? parseFloat(questionForm.points) : 1.0,
        options: options,
        correct_option_id: correct_option_id,
        correct_answer: correct_answer,
        extended_config: extended_config,
        learning_outcome: questionForm.learning_outcome || null,
        bloom_taxonomy: questionForm.bloom_taxonomy || null,
        image_url: questionForm.image_url || null,
        has_text_input: questionForm.has_text_input,
        allow_critique: questionForm.allow_critique === true // Default to false
      };

      const response = await apiClient.put(`/api/questions/${selectedQuestion.id}`, payload);

      // Upload new image if one was selected
      if (selectedImageFile) {
        const imageUrl = await handleImageUpload(selectedQuestion.id);
        if (imageUrl) {
          response.image_url = imageUrl;
        }
      }

      setQuestions(questions.map(q => q.id === selectedQuestion.id ? response : q));
      setIsEditOpen(false);
      setSelectedQuestion(null);
      resetForm();
      clearImageSelection();
    } catch (error) {
      console.error('Edit error:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiClient.delete(`/api/questions/${id}`);
      setQuestions(questions.filter(q => q.id !== id));
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const openEditDialog = (question) => {
    setSelectedQuestion(question);

    // Convert options from dict to array for form handling
    let optionsArray = ["", "", "", ""];
    if (question.options && typeof question.options === 'object') {
      optionsArray = Object.values(question.options);
      // Ensure we have 4 slots
      while (optionsArray.length < 4) optionsArray.push("");
    }

    // Get the correct option ID - could be in correct_option_id or correct_answer for MCQ
    let correctOptionId = "";
    if (question.type === "mcq") {
      correctOptionId = question.correct_option_id || question.correct_answer || "";
    }

    // Extract extended_config data for new question types
    let blanks = [];
    let correct_option_ids = [];
    let partial_credit = true;
    let penalty_for_wrong = true;
    let sub_questions = [];

    if (question.type === "mcq_multiple" && question.extended_config) {
      correct_option_ids = question.extended_config.correct_option_ids || [];
      partial_credit = question.extended_config.partial_credit !== undefined ? question.extended_config.partial_credit : true;
      penalty_for_wrong = question.extended_config.penalty_for_wrong !== undefined ? question.extended_config.penalty_for_wrong : true;
    }

    if (question.type === "fill_blank" && question.extended_config) {
      blanks = question.extended_config.blanks || [];
      // Regenerate context from question text
      if (question.text) {
        const parts = question.text.split('___');
        blanks = blanks.map((blank, index) => ({
          ...blank,
          context: {
            before: parts[index]?.slice(-20) || '',
            after: parts[index + 1]?.slice(0, 20) || ''
          }
        }));
      }
    }

    if (question.type === "multi_part" && question.extended_config) {
      sub_questions = question.extended_config.sub_questions || [];
    }

    console.log("📝 Opening edit dialog for question:", question);
    console.log("Type:", question.type);
    console.log("Extended config:", question.extended_config);

    setQuestionForm({
      type: question.type,
      text: question.text,
      slide_number: question.slide_number?.toString() || "",
      points: question.points?.toString() || "1.0",
      options: optionsArray,
      correct_answer: question.type !== "mcq" && question.type !== "mcq_multiple" ? (question.correct_answer || "") : "",
      correct_option_id: correctOptionId,
      learning_outcome: question.learning_outcome || "",
      bloom_taxonomy: question.bloom_taxonomy || "",
      image_url: question.image_url || "",
      has_text_input: question.has_text_input || false,
      allow_critique: question.allow_critique !== undefined ? question.allow_critique : false, // Default to false if not set
      // New question types fields
      extended_config: question.extended_config || null,
      blanks: blanks,
      correct_option_ids: correct_option_ids,
      partial_credit: partial_credit,
      penalty_for_wrong: penalty_for_wrong,
      sub_questions: sub_questions
    });

    // Set image preview if question has an image
    if (question.image_url) {
      setImagePreview(question.image_url);
    } else {
      setImagePreview(null);
    }
    setSelectedImageFile(null);

    setIsEditOpen(true);
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...questionForm.options];
    newOptions[index] = value;
    setQuestionForm({...questionForm, options: newOptions});
  };

  // Helper function to detect blanks in fill_blank questions
  const detectBlanksInText = (text) => {
    const blankMarker = '___';
    const parts = text.split(blankMarker);
    const blanks = [];

    for (let i = 0; i < parts.length - 1; i++) {
      const beforeText = parts[i].slice(-20); // Last 20 chars before blank
      const afterText = parts[i + 1].slice(0, 20); // First 20 chars after blank

      blanks.push({
        position: i,
        correct_answers: questionForm.blanks?.[i]?.correct_answers || [],
        points: questionForm.blanks?.[i]?.points || 1,
        case_sensitive: questionForm.blanks?.[i]?.case_sensitive || false,
        context: { before: beforeText, after: afterText }
      });
    }

    return blanks;
  };

  // Handle question text change for fill_blank type
  const handleQuestionTextChange = (text) => {
    if (questionForm.type === 'fill_blank') {
      const detectedBlanks = detectBlanksInText(text);
      setQuestionForm({
        ...questionForm,
        text: text,
        blanks: detectedBlanks
      });
    } else {
      setQuestionForm({...questionForm, text: text});
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert('Please select a valid image file (JPG, PNG, GIF, or WebP)');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
      }

      setSelectedImageFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async (questionId) => {
    if (!selectedImageFile) {
      console.log('No image file selected');
      return null;
    }

    try {
      setIsUploadingImage(true);
      const formData = new FormData();
      formData.append('file', selectedImageFile);

      console.log('==================== IMAGE UPLOAD START ====================');
      console.log('📤 Uploading image for question:', questionId);
      console.log('File name:', selectedImageFile.name);
      console.log('File type:', selectedImageFile.type);
      console.log('File size:', selectedImageFile.size, 'bytes');
      console.log('API endpoint:', `/api/questions/${questionId}/upload-image`);

      // Use native fetch instead of apiClient to properly handle multipart/form-data
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('token');
      const fetchResponse = await fetch(`${API_BASE_URL}/api/questions/${questionId}/upload-image`, {
        method: 'POST',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
          // Do NOT set Content-Type - browser sets it automatically with boundary for FormData
        },
        body: formData
      });

      if (!fetchResponse.ok) {
        const errorData = await fetchResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${fetchResponse.status}`);
      }

      const response = await fetchResponse.json();

      console.log('✅ Upload successful!');
      console.log('Response:', JSON.stringify(response, null, 2));

      // Response is the parsed JSON directly from fetch
      const imageUrl = response.image_url;

      if (!imageUrl) {
        console.error('❌ No image_url in response!');
        console.error('Full response object:', response);
        throw new Error('Server did not return image URL');
      }

      console.log('Image URL:', imageUrl);
      console.log('==================== IMAGE UPLOAD END ====================');

      return imageUrl;
    } catch (error) {
      console.error('==================== IMAGE UPLOAD ERROR ====================');
      console.error('❌ Image upload failed!');

      // Try to stringify the entire error object
      try {
        console.error('Error (stringified):', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch (e) {
        console.error('Error (could not stringify):', error);
      }

      console.error('Error message:', error.message);
      console.error('Error name:', error.name);
      console.error('Error stack:', error.stack);

      console.error('==================== ERROR END ====================');

      const errorMsg = (typeof error.message === 'string' ? error.message : JSON.stringify(error.message))
        || 'Unknown error';

      alert(`Failed to upload image: ${errorMsg}\n\nCheck browser console for details.`);
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageRemove = async (questionId) => {
    if (!confirm('Remove image from this question?')) return;

    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/questions/${questionId}/image`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      // Update local state
      setQuestionForm({...questionForm, image_url: ""});
      setImagePreview(null);
      setSelectedImageFile(null);

      // Update questions list
      setQuestions(questions.map(q =>
        q.id === questionId ? {...q, image_url: null} : q
      ));

      alert('Image removed successfully');
    } catch (error) {
      console.error('Image remove error:', error);
      alert('Failed to remove image');
    }
  };

  const clearImageSelection = () => {
    setSelectedImageFile(null);
    setImagePreview(null);
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
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

  if (!moduleName) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl mb-4">No Module Selected</h1>
        <Button asChild>
          <Link href="/mymodules">Go to My Modules</Link>
        </Button>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)"
      }}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="min-h-screen bg-background">
          <div className="max-w-7xl mx-auto px-6 py-12">
            {/* Header */}
            <div className="mb-10">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold text-foreground mb-2">Questions - {moduleName}</h1>
                  <p className="text-muted-foreground">
                    Create and manage questions for your module assessments
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleExport} disabled={questions.length === 0}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                  <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </Button>
                </div>
              </div>
            </div>

            {/* Import Dialog */}
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
              <DialogContent className="max-w-3xl">
                {isUploading ? (
                  <div className="py-16">
                    <div className="flex flex-col items-center justify-center space-y-8">
                      {/* Spinner — always purple for testbank */}
                      <div className="relative">
                        <div className="w-32 h-32 border-8 border-purple-200/30 rounded-full"></div>
                        <div className="w-32 h-32 border-8 border-purple-600 border-t-transparent rounded-full animate-spin absolute top-0"></div>
                        <div className="w-24 h-24 border-4 border-pink-500/40 border-b-transparent rounded-full animate-spin absolute top-4 left-4" style={{ animationDuration: '3s', animationDirection: 'reverse' }}></div>
                        <Sparkles className="w-12 h-12 text-purple-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                      </div>
                      <div className="text-center space-y-3">
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
                        {uploadForm.file && (
                          <div className="mt-6 p-6 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 dark:from-purple-950/30 dark:via-pink-950/20 dark:to-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl inline-block">
                            <div className="flex items-center gap-3 mb-3">
                              <FileCheck className="w-6 h-6 text-purple-600" />
                              <p className="text-base font-semibold">{uploadForm.file.name}</p>
                            </div>
                            <p className="text-sm text-muted-foreground">{formatFileSize(uploadForm.file.size)}</p>
                            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-purple-200/50 dark:bg-purple-900/50 rounded-full">
                              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">Testbank File</span>
                            </div>
                          </div>
                        )}
                      </div>
                      {/* 4-stage progress */}
                      <div className="flex items-center gap-3 mt-4">
                        {[{ icon: Upload, label: 'Upload' }, { icon: FileText, label: 'Extract' }, { icon: Cpu, label: 'Parse' }, { icon: CheckCircle, label: 'Save' }].map((step, i) => (
                          <div key={i} className="flex items-center">
                            <div className="flex flex-col items-center gap-2">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${uploadStage >= i ? 'bg-purple-600 text-white scale-110' : 'bg-muted text-muted-foreground'}`}>
                                <step.icon className="w-6 h-6" />
                              </div>
                              <span className={`text-xs font-medium ${uploadStage >= i ? 'text-purple-600' : 'text-muted-foreground'}`}>{step.label}</span>
                            </div>
                            {i < 3 && <div className={`w-12 h-1 rounded-full mx-2 transition-all ${uploadStage > i ? 'bg-purple-600' : 'bg-muted'}`}></div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle className="text-2xl flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-purple-600" />
                        Import Testbank
                      </DialogTitle>
                      <DialogDescription>
                        Upload a testbank file — the filename must contain &quot;testbank&quot;. Questions will be auto-extracted and added to your question bank. To upload regular course materials, use the Documents tab.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleImport} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="import-file">Select Testbank File</Label>
                        <Input
                          id="import-file"
                          type="file"
                          onChange={(e) => {
                            const selectedFile = e.target.files[0];
                            setUploadForm({ ...uploadForm, file: selectedFile });
                            if (selectedFile) {
                              const isTestbankFile = selectedFile.name.toLowerCase().includes('testbank');
                              setIsTestbank(isTestbankFile);
                            }
                          }}
                          required
                        />
                        {uploadForm.file && (
                          <div className={`mt-2 p-3 rounded-lg border ${isTestbank ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'}`}>
                            <div className="flex items-center gap-2 text-sm">
                              <FileCheck className={`w-4 h-4 ${isTestbank ? 'text-purple-500' : 'text-red-500'}`} />
                              <span className="font-medium">{uploadForm.file.name}</span>
                              <span className="text-muted-foreground ml-auto">{formatFileSize(uploadForm.file.size)}</span>
                            </div>
                            {isTestbank ? (
                              <div className="mt-2 flex items-center gap-2">
                                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  Testbank Detected
                                </Badge>
                                <span className="text-xs text-muted-foreground">Questions will be auto-extracted</span>
                              </div>
                            ) : (
                              <div className="mt-2 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                <span className="text-xs text-red-600 dark:text-red-400">
                                  Filename must contain &quot;testbank&quot;. Rename your file or use the Documents tab for regular files.
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="import-title">Title (optional)</Label>
                        <Input
                          id="import-title"
                          value={uploadForm.title}
                          onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                          placeholder="Leave empty to use filename"
                        />
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsImportOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={!uploadForm.file || !isTestbank}
                          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Import Testbank
                        </Button>
                      </DialogFooter>
                    </form>
                  </>
                )}
              </DialogContent>
            </Dialog>

            {/* Unreviewed Questions Alert */}
            {unreviewedCount > 0 && (
              <Card className="mb-6 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                            {unreviewedCount} AI-Generated Question{unreviewedCount > 1 ? 's' : ''} Pending Review
                          </h3>
                          <Badge className="bg-purple-600 text-white">
                            {unreviewedCount}
                          </Badge>
                        </div>
                        <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                          Review and approve AI-generated questions before they become available to students
                        </p>
                      </div>
                    </div>
                    <Button
                      asChild
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Link href={`/dashboard/questions/review?module_id=${currentModule?.id}&module_name=${encodeURIComponent(moduleName)}&status=unreviewed`}>
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Review Questions
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Sidebar - Create Question Form */}
              <div className="lg:col-span-4">
                <Card className={`sticky top-6 max-h-[calc(100vh-8rem)] overflow-hidden flex flex-col ${isEditOpen ? 'opacity-50 pointer-events-none' : ''}`}>
                  <CardHeader className="flex-shrink-0">
                    <CardTitle className="text-lg text-blue-600 dark:text-blue-400 flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      Create New Question
                    </CardTitle>
                    <CardDescription>Add a new question to your module</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-y-auto flex-1">
                    <form onSubmit={handleCreate} className="space-y-4">
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                          <BookOpen className="w-4 h-4" />
                          <span>Module: <strong>{moduleName}</strong></span>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="type">Question Type *</Label>
                        <Select value={questionForm.type} onValueChange={(value) => {
                          // Reset type-specific fields when type changes
                          const newForm = {
                            ...questionForm,
                            type: value,
                            points: getDefaultPoints(value).toString(),
                            blanks: value === 'fill_blank' ? [] : [],
                            correct_option_ids: value === 'mcq_multiple' ? [] : [],
                            sub_questions: value === 'multi_part' ? [] : []
                          };
                          setQuestionForm(newForm);
                        }}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mcq">Multiple Choice (Single Answer)</SelectItem>
                            <SelectItem value="mcq_multiple">Multiple Choice (Multiple Answers)</SelectItem>
                            <SelectItem value="fill_blank">Fill in the Blanks</SelectItem>
                            <SelectItem value="short">Short Answer</SelectItem>
                            <SelectItem value="long">Long Answer</SelectItem>
                            {/* <SelectItem value="multi_part">Multi-Part Question</SelectItem> */}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="text">Question Text *</Label>
                        <Textarea
                          id="text"
                          value={questionForm.text}
                          onChange={(e) => handleQuestionTextChange(e.target.value)}
                          placeholder="Enter your question..."
                          required
                          rows={3}
                          className="mt-1"
                          spellCheck={true}
                        />
                      </div>

                      {/* Image Upload Section */}
                      <div>
                        <Label>Question Image (Optional)</Label>
                        <div className="mt-2 space-y-3">
                          {imagePreview ? (
                            <div className="relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imagePreview}
                                alt="Question preview"
                                className="w-full max-h-64 object-contain rounded-lg border border-border"
                              />
                              <div className="flex gap-2 mt-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => document.getElementById('image-upload').click()}
                                >
                                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                                  <Image className="w-4 h-4 mr-2" />
                                  Replace Image
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={clearImageSelection}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => document.getElementById('image-upload').click()}
                              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
                            >
                              {/* eslint-disable-next-line jsx-a11y/alt-text */}
                              <Image className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                              <p className="text-sm font-medium mb-1">Click to upload an image</p>
                              <p className="text-xs text-muted-foreground">
                                JPG, PNG, GIF or WebP (max 5MB)
                              </p>
                            </div>
                          )}
                          <input
                            id="image-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleImageSelect}
                            className="hidden"
                          />
                        </div>
                      </div>

                      {questionForm.type === "mcq" && (
                        <div>
                          <Label>Answer Options *</Label>
                          <div className="space-y-2 mt-2">
                            {questionForm.options.map((option, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-medium text-blue-600 dark:text-blue-400">
                                  {String.fromCharCode(65 + index)}
                                </span>
                                <Input
                                  value={option}
                                  onChange={(e) => handleOptionChange(index, e.target.value)}
                                  placeholder={`Option ${index + 1}`}
                                  className="flex-1 text-sm"
                                  spellCheck={true}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* MCQ Multiple - Checkboxes for multiple correct answers */}
                      {questionForm.type === "mcq_multiple" && (
                        <div className="space-y-4">
                          <div>
                            <Label>Answer Options *</Label>
                            <div className="space-y-2 mt-2">
                              {questionForm.options.map((option, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-medium text-green-600 dark:text-green-400">
                                    {String.fromCharCode(65 + index)}
                                  </span>
                                  <Input
                                    value={option}
                                    onChange={(e) => handleOptionChange(index, e.target.value)}
                                    placeholder={`Option ${index + 1}`}
                                    className="flex-1 text-sm"
                                    spellCheck={true}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <Label>Correct Answers * (Select all that apply)</Label>
                            <div className="space-y-2 mt-2 p-3 border rounded-lg">
                              {(questionForm.options || []).map((option, index) => {
                                const letter = String.fromCharCode(65 + index);
                                const isChecked = (questionForm.correct_option_ids || []).includes(letter);
                                return (
                                  <div key={letter} className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      id={`correct-${letter}`}
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const currentIds = questionForm.correct_option_ids || [];
                                        const newCorrectIds = e.target.checked
                                          ? [...currentIds, letter]
                                          : currentIds.filter(id => id !== letter);
                                        setQuestionForm({...questionForm, correct_option_ids: newCorrectIds});
                                      }}
                                      className="h-4 w-4 text-green-600 focus:ring-green-500"
                                    />
                                    <Label htmlFor={`correct-${letter}`} className="cursor-pointer flex-1">
                                      {letter} - {option || "(empty)"}
                                    </Label>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Fill in the Blanks */}
                      {questionForm.type === "fill_blank" && (
                        <div className="space-y-4">
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                              <strong>Auto-detection:</strong> Use <strong>___</strong> (three underscores) in your question text to mark blanks.
                              Blanks will be automatically detected and you can define correct answers for each below.
                            </p>
                          </div>
                          <div>
                            <Label>Blanks Configuration</Label>
                            <div className="space-y-3 mt-2">
                              {(questionForm.blanks || []).map((blank, index) => (
                                <div key={index} className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-sm">Blank {index + 1}</span>
                                  </div>
                                  {blank.context && (
                                    <div className="mb-3 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-xs font-mono">
                                      <span className="text-gray-600 dark:text-gray-400">{blank.context.before}</span>
                                      <span className="px-2 py-1 bg-yellow-300 dark:bg-yellow-600 text-yellow-900 dark:text-yellow-100 font-bold">___</span>
                                      <span className="text-gray-600 dark:text-gray-400">{blank.context.after}</span>
                                    </div>
                                  )}
                                  <div className="space-y-2">
                                    <Input
                                      placeholder="Correct answer (comma-separated for multiple)"
                                      value={(blank.correct_answers || []).join(', ')}
                                      onChange={(e) => {
                                        const newBlanks = [...(questionForm.blanks || [])];
                                        newBlanks[index].correct_answers = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                        setQuestionForm({...questionForm, blanks: newBlanks});
                                      }}
                                      className="text-sm"
                                    />
                                  </div>
                                </div>
                              ))}
                              {questionForm.blanks.length === 0 && (
                                <div className="text-center py-4 text-sm text-gray-500">
                                  No blanks detected. Add <strong>___</strong> (three underscores) in your question text above.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Multi-Part Questions */}
                      {questionForm.type === "multi_part" && (
                        <div className="space-y-4">
                          <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                            <p className="text-sm text-purple-800 dark:text-purple-200">
                              Create sub-questions (e.g., 1a, 1b, 1c) with different types (MCQ, Short, Long)
                            </p>
                          </div>
                          <div>
                            <Label>Sub-Questions</Label>
                            <div className="space-y-4 mt-2">
                              {(questionForm.sub_questions || []).map((subQ, index) => (
                                <div key={index} className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                                  <div className="flex items-center justify-between mb-3">
                                    <Input
                                      placeholder="ID (e.g., 1a)"
                                      value={subQ.id}
                                      onChange={(e) => {
                                        const newSubQs = [...(questionForm.sub_questions || [])];
                                        newSubQs[index].id = e.target.value;
                                        setQuestionForm({...questionForm, sub_questions: newSubQs});
                                      }}
                                      className="w-24 text-sm"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const newSubQs = (questionForm.sub_questions || []).filter((_, i) => i !== index);
                                        setQuestionForm({...questionForm, sub_questions: newSubQs});
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                  </div>
                                  <div className="space-y-2">
                                    <Select
                                      value={subQ.type}
                                      onValueChange={(value) => {
                                        const newSubQs = [...(questionForm.sub_questions || [])];
                                        newSubQs[index].type = value;
                                        setQuestionForm({...questionForm, sub_questions: newSubQs});
                                      }}
                                    >
                                      <SelectTrigger className="text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="mcq">MCQ</SelectItem>
                                        <SelectItem value="short">Short</SelectItem>
                                        <SelectItem value="long">Long</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Textarea
                                      placeholder="Sub-question text"
                                      value={subQ.text}
                                      onChange={(e) => {
                                        const newSubQs = [...(questionForm.sub_questions || [])];
                                        newSubQs[index].text = e.target.value;
                                        setQuestionForm({...questionForm, sub_questions: newSubQs});
                                      }}
                                      rows={2}
                                      className="text-sm"
                                    />
                                    {subQ.type === 'mcq' && (
                                      <>
                                        <div>
                                          <Label className="text-xs">Answer Options *</Label>
                                          <div className="space-y-2 mt-2">
                                            {['A', 'B', 'C', 'D'].map((letter, optIdx) => {
                                              const optionValue = subQ.options?.[letter] || '';
                                              return (
                                                <div key={letter} className="flex items-center gap-2">
                                                  <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-xs font-medium text-purple-600 dark:text-purple-400">
                                                    {letter}
                                                  </span>
                                                  <Input
                                                    value={optionValue}
                                                    onChange={(e) => {
                                                      const newSubQs = [...(questionForm.sub_questions || [])];
                                                      const currentOptions = newSubQs[index].options || {};
                                                      newSubQs[index].options = {
                                                        ...currentOptions,
                                                        [letter]: e.target.value
                                                      };
                                                      setQuestionForm({...questionForm, sub_questions: newSubQs});
                                                    }}
                                                    placeholder={`Option ${letter}`}
                                                    className="flex-1 text-xs"
                                                  />
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                        <div>
                                          <Label className="text-xs">Correct Answer *</Label>
                                          <Select
                                            value={subQ.correct_option_id || ''}
                                            onValueChange={(value) => {
                                              const newSubQs = [...(questionForm.sub_questions || [])];
                                              newSubQs[index].correct_option_id = value;
                                              setQuestionForm({...questionForm, sub_questions: newSubQs});
                                            }}
                                          >
                                            <SelectTrigger className="mt-1 text-xs">
                                              <SelectValue placeholder="Select correct option" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {['A', 'B', 'C', 'D'].map((letter) => {
                                                const optionText = subQ.options?.[letter] || `Option ${letter}`;
                                                return (
                                                  <SelectItem key={letter} value={letter}>
                                                    {letter} - {optionText}
                                                  </SelectItem>
                                                );
                                              })}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </>
                                    )}
                                    {(subQ.type === 'short' || subQ.type === 'long') && (
                                      <div>
                                        <Label className="text-xs">Correct Answer *</Label>
                                        <Textarea
                                          value={subQ.correct_answer || ''}
                                          onChange={(e) => {
                                            const newSubQs = [...(questionForm.sub_questions || [])];
                                            newSubQs[index].correct_answer = e.target.value;
                                            setQuestionForm({...questionForm, sub_questions: newSubQs});
                                          }}
                                          placeholder="Enter the correct answer or acceptable answer"
                                          rows={subQ.type === 'long' ? 4 : 2}
                                          className="text-xs mt-1"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const currentSubQs = questionForm.sub_questions || [];
                                  setQuestionForm({
                                    ...questionForm,
                                    sub_questions: [...currentSubQs, { id: '', type: 'mcq', text: '', points: 1, options: { A: '', B: '', C: '', D: '' }, correct_option_id: null }]
                                  });
                                }}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Sub-Question
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Only show correct answer field for traditional question types */}
                      {!["mcq_multiple", "fill_blank", "multi_part"].includes(questionForm.type) && (
                        <div>
                          <Label htmlFor="correct_answer">
                            {questionForm.type === "mcq" && "Correct Answer *"}
                            {questionForm.type === "short" && "Sample Correct Answer"}
                            {questionForm.type === "long" && "Sample Correct Answer"}
                          </Label>
                          {questionForm.type === "mcq" ? (
                            <Select
                              value={questionForm.correct_option_id}
                              onValueChange={(value) => setQuestionForm({...questionForm, correct_option_id: value})}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select the correct option" />
                              </SelectTrigger>
                              <SelectContent>
                                {questionForm.options
                                  .map((option, index) => {
                                    const letter = String.fromCharCode(65 + index);
                                    // Keep all 4 options even if empty, to maintain correct letter-to-index mapping
                                    return (
                                      <SelectItem key={letter} value={letter}>
                                        {letter} - {option || "(empty)"}
                                      </SelectItem>
                                    );
                                  })}
                              </SelectContent>
                            </Select>
                          ) : questionForm.type === "long" ? (
                            <Textarea
                              id="correct_answer"
                              value={questionForm.correct_answer}
                              onChange={(e) => setQuestionForm({...questionForm, correct_answer: e.target.value})}
                              placeholder="Enter sample correct answer"
                              className="mt-1 min-h-[120px]"
                              spellCheck={true}
                            />
                          ) : (
                            <Input
                              id="correct_answer"
                              value={questionForm.correct_answer}
                              onChange={(e) => setQuestionForm({...questionForm, correct_answer: e.target.value})}
                              placeholder="Enter correct answer"
                              className="mt-1"
                              spellCheck={true}
                            />
                          )}
                        </div>
                      )}

                      <div>
                        <Label htmlFor="slide_number">Slide Number</Label>
                        <Input
                          id="slide_number"
                          type="number"
                          value={questionForm.slide_number}
                          onChange={(e) => setQuestionForm({...questionForm, slide_number: e.target.value})}
                          placeholder="Optional"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="points">Points *</Label>
                        <Input
                          id="points"
                          type="number"
                          step="0.1"
                          min="0"
                          value={questionForm.points}
                          onChange={(e) => setQuestionForm({...questionForm, points: e.target.value})}
                          placeholder="1.0"
                          required
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Points awarded for correct answer
                        </p>
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label htmlFor="allow_critique" className="text-base font-medium">
                            Allow Feedback Critique
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Let students rate and comment on AI feedback for this question
                          </p>
                        </div>
                        <Switch
                          id="allow_critique"
                          checked={questionForm.allow_critique}
                          onCheckedChange={(checked) => setQuestionForm({...questionForm, allow_critique: checked})}
                        />
                      </div>

                      <div>
                        <Label htmlFor="bloom_taxonomy">Bloom&apos;s Taxonomy</Label>
                        <Select value={questionForm.bloom_taxonomy} onValueChange={(value) => setQuestionForm({...questionForm, bloom_taxonomy: value})}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="remember">Remember</SelectItem>
                            <SelectItem value="understand">Understand</SelectItem>
                            <SelectItem value="apply">Apply</SelectItem>
                            <SelectItem value="analyze">Analyze</SelectItem>
                            <SelectItem value="evaluate">Evaluate</SelectItem>
                            <SelectItem value="create">Create</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="pt-4 space-y-2">
                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                          <Plus className="w-4 h-4 mr-2" />
                          Create Question
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="w-full"
                          onClick={resetForm}
                        >
                          Clear Form
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Right Content - Questions List */}
              <div className="lg:col-span-8">
                {/* Search and Filter */}
                <div className="mb-6 flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search questions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="mcq">Multiple Choice</SelectItem>
                      <SelectItem value="short">Short Answer</SelectItem>
                      <SelectItem value="long">Long Answer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Module Statistics */}
                {filteredQuestions.length > 0 && (
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 border-blue-200 dark:border-blue-800">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">Total Questions</p>
                            <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{filteredQuestions.length}</p>
                          </div>
                          <HelpCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/50 border-amber-200 dark:border-amber-800">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">Total Points</p>
                            <p className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                              {filteredQuestions.reduce((sum, q) => sum + (q.points || 1.0), 0).toFixed(1)}
                            </p>
                          </div>
                          <Trophy className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50 border-purple-200 dark:border-purple-800">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">Question Types</p>
                            <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                              {[...new Set(filteredQuestions.map(q => q.type))].length}
                            </p>
                          </div>
                          <Sparkles className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Questions List */}
                {loadingQuestions ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Card key={i} className="border-0 shadow-sm bg-white dark:bg-slate-900/50">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <div className="flex flex-col items-center gap-2">
                              <Skeleton className="w-10 h-10 rounded-full" />
                              <Skeleton className="w-5 h-5 rounded" />
                            </div>
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center gap-2">
                                <Skeleton className="h-5 w-24 rounded" />
                                <Skeleton className="h-5 w-20 rounded" />
                              </div>
                              <Skeleton className="h-5 w-full" />
                              <Skeleton className="h-4 w-3/4" />
                              <div className="space-y-2">
                                <Skeleton className="h-10 w-full rounded-lg" />
                                <Skeleton className="h-10 w-full rounded-lg" />
                                <Skeleton className="h-10 w-full rounded-lg" />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Skeleton className="h-8 w-20" />
                              <Skeleton className="h-8 w-20" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {filteredQuestions.map((question, index) => (
                        <Card key={question.id} className="border-0 shadow-sm bg-white dark:bg-slate-900/50 hover:shadow-md transition-all duration-200">
                          <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                        <div className="flex flex-col items-center gap-1.5 sm:gap-2 flex-shrink-0">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white font-bold text-xs sm:text-sm">
                            {index + 1}
                          </div>
                          {getQuestionIcon(question.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap">
                            <Badge className={`text-[10px] sm:text-xs ${getQuestionTypeBadge(question.type)}`}>
                              {getQuestionTypeLabel(question.type)}
                            </Badge>
                            {question.points !== null && question.points !== undefined && (
                              <Badge variant="outline" className="text-[10px] sm:text-xs bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                                <Trophy className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                                {question.points} {question.points === 1 ? 'pt' : 'pts'}
                              </Badge>
                            )}
                            {question.slide_number && (
                              <Badge variant="outline" className="text-[10px] sm:text-xs">
                                Slide {question.slide_number}
                              </Badge>
                            )}
                            {question.bloom_taxonomy && (
                              <Badge variant="secondary" className="text-[10px] sm:text-xs">
                                <Brain className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                                {question.bloom_taxonomy}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm sm:text-base text-foreground font-medium mb-3 leading-relaxed whitespace-pre-wrap">
                            {question.text}
                          </p>
                          {question.image_url && (
                            <div className="mb-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={question.image_url}
                                alt="Question illustration"
                                className="max-h-48 rounded-lg border border-border object-contain"
                              />
                            </div>
                          )}
                          {question.type === "mcq" && question.options && typeof question.options === 'object' && (
                            <div className="space-y-2 text-xs sm:text-sm">
                              {Object.entries(question.options).map(([key, option]) => {
                                const isCorrect = key === (question.correct_option_id || question.correct_answer);
                                return (
                                  <div
                                    key={key}
                                    className={`flex items-center gap-2 p-2 sm:p-3 rounded-lg border ${
                                      isCorrect
                                        ? 'bg-green-50 dark:bg-green-950/50 border-green-300 dark:border-green-700'
                                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                    }`}
                                  >
                                    <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold flex-shrink-0 ${
                                      isCorrect
                                        ? 'bg-green-600 dark:bg-green-500 text-white'
                                        : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                                    }`}>
                                      {key}
                                    </span>
                                    <span className={`flex-1 whitespace-pre-wrap min-w-0 ${isCorrect ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{option}</span>
                                    {isCorrect && (
                                      <div className="ml-auto flex items-center gap-1 sm:gap-1.5 text-green-700 dark:text-green-400 flex-shrink-0">
                                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                                        <span className="text-[10px] sm:text-xs font-bold hidden sm:inline">Correct</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Fill-in-the-Blank Correct Answers Display */}
                          {question.type === "fill_blank" && question.extended_config && question.extended_config.blanks && (
                            <div className="mt-3 space-y-2">
                              <div className="text-xs font-bold text-yellow-700 dark:text-yellow-400 mb-2 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                <span>Correct Answers:</span>
                              </div>
                              {question.extended_config.blanks.map((blank, index) => {
                                const parts = question.text.split('___');
                                const beforeText = parts[index]?.slice(-15) || '';
                                const afterText = parts[index + 1]?.slice(0, 15) || '';

                                return (
                                  <div key={index} className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                    <div className="flex items-start gap-2">
                                      <span className="w-6 h-6 rounded-full bg-yellow-500 dark:bg-yellow-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                        {index + 1}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 font-mono truncate">
                                          <span className="opacity-60">...{beforeText}</span>
                                          <span className="px-1 text-yellow-600 dark:text-yellow-400 font-bold">___</span>
                                          <span className="opacity-60">{afterText}...</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {(blank.correct_answers || []).map((answer, ansIndex) => (
                                            <span key={ansIndex} className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-xs font-medium rounded border border-green-300 dark:border-green-700">
                                              {answer}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* MCQ Multiple Correct Answers Display */}
                          {question.type === "mcq_multiple" && question.options && question.extended_config && question.extended_config.correct_option_ids && (
                            <div className="space-y-2 text-sm">
                              {Object.entries(question.options).map(([key, option]) => {
                                const isCorrect = question.extended_config.correct_option_ids.includes(key);
                                return (
                                  <div
                                    key={key}
                                    className={`flex items-center gap-2 p-3 rounded-lg border ${
                                      isCorrect
                                        ? 'bg-green-50 dark:bg-green-950/50 border-green-300 dark:border-green-700'
                                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                    }`}
                                  >
                                    <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                                      isCorrect
                                        ? 'bg-green-600 dark:bg-green-500 text-white'
                                        : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                                    }`}>
                                      {key}
                                    </span>
                                    <span className={`flex-1 whitespace-pre-wrap ${isCorrect ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{option}</span>
                                    {isCorrect && (
                                      <div className="ml-auto flex items-center gap-1.5 text-green-700 dark:text-green-400">
                                        <CheckCircle className="w-4 h-4" />
                                        <span className="text-xs font-bold">Correct</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Multi-Part Questions Display */}
                          {question.type === "multi_part" && question.extended_config && question.extended_config.sub_questions && (
                            <div className="mt-3 space-y-3">
                              <div className="text-xs font-bold text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                <span>Sub-Questions:</span>
                              </div>
                              {question.extended_config.sub_questions.map((subQ, index) => (
                                <div key={index} className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg">
                                  <div className="flex items-start gap-2">
                                    <span className="px-2 py-1 rounded bg-purple-500 dark:bg-purple-600 text-white text-xs font-bold flex-shrink-0">
                                      {subQ.id}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">{subQ.text}</p>
                                      {subQ.type === 'mcq' && subQ.options && (
                                        <div className="space-y-1 text-xs">
                                          {Object.entries(subQ.options).map(([key, opt]) => {
                                            const isCorrect = key === subQ.correct_option_id;
                                            return (
                                              <div key={key} className={`flex items-center gap-2 p-2 rounded ${isCorrect ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                                                <span className="font-bold">{key}.</span>
                                                <span className="flex-1">{opt}</span>
                                                {isCorrect && <CheckCircle className="w-3 h-3" />}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {subQ.type !== 'mcq' && subQ.correct_answer && (
                                        <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded text-xs">
                                          <span className="text-green-700 dark:text-green-400 font-medium">Answer: {subQ.correct_answer}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {question.type !== "mcq" && question.type !== "fill_blank" && question.type !== "mcq_multiple" && question.type !== "multi_part" && question.correct_answer && (
                            <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/50 border border-green-300 dark:border-green-700 rounded-lg">
                              <div className="flex items-start gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-1.5">Correct Answer:</p>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white whitespace-pre-wrap">{question.correct_answer}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {question.learning_outcome && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Target className="w-3 h-3" />
                              <span>{question.learning_outcome}</span>
                            </div>
                          )}
                          {question.image_url && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              {/* eslint-disable-next-line jsx-a11y/alt-text */}
                              <Image className="w-3 h-3" />
                              <span>Has image attachment</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(question)}
                          className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
                        >
                          <Edit3 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
                          onClick={() => handleDelete(question.id)}
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Delete</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                        </Card>
                      ))}
                    </div>

                    {filteredQuestions.length === 0 && (
                      <Card className="border-2 border-dashed border-muted-foreground/25 bg-muted/5">
                        <CardContent className="py-16 text-center">
                          <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                          <h3 className="text-lg font-medium text-muted-foreground mb-2">
                            No questions found
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            {searchTerm || filterType !== "all"
                              ? "Try adjusting your search or filter criteria"
                              : "Use the form on the left to create your first question"
                            }
                          </p>
                          <div className="text-xs text-muted-foreground/70 mb-4 p-2 bg-muted/30 rounded">
                            Debug: Total questions: {questions.length}, Filtered: {filteredQuestions.length}<br/>
                            Module: {currentModule?.name} (ID: {currentModule?.id})<br/>
                            Search: &quot;{searchTerm}&quot;, Filter: {filterType}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
            </div>
          </div>
        </div>
        </div>
      </SidebarInset>
      
      {/* Edit Drawer */}
        <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DrawerContent className="max-h-[85vh] flex flex-col">
            <DrawerHeader className="border-b bg-blue-50 dark:bg-blue-950/30 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Edit3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DrawerTitle className="text-lg">Edit Question</DrawerTitle>
                  <DrawerDescription className="text-sm">
                    Update question details for {moduleName}
                  </DrawerDescription>
                </div>
              </div>
            </DrawerHeader>

            <form onSubmit={handleEdit} className="flex flex-col flex-1 min-h-0">
              <div className="px-4 py-4 space-y-4 overflow-y-auto flex-1">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                    <BookOpen className="w-4 h-4" />
                    <span>Module: <strong>{moduleName}</strong></span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-type">Question Type *</Label>
                  <Select value={questionForm.type} onValueChange={(value) => {
                    const newForm = {
                      ...questionForm,
                      type: value,
                      points: getDefaultPoints(value).toString(),
                      blanks: value === 'fill_blank' ? (questionForm.blanks || []) : [],
                      correct_option_ids: value === 'mcq_multiple' ? (questionForm.correct_option_ids || []) : [],
                      sub_questions: value === 'multi_part' ? (questionForm.sub_questions || []) : []
                    };
                    setQuestionForm(newForm);
                  }}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcq">Multiple Choice (Single Answer)</SelectItem>
                      <SelectItem value="mcq_multiple">Multiple Choice (Multiple Answers)</SelectItem>
                      <SelectItem value="fill_blank">Fill in the Blanks</SelectItem>
                      <SelectItem value="short">Short Answer</SelectItem>
                      <SelectItem value="long">Long Answer</SelectItem>
                      {/* <SelectItem value="multi_part">Multi-Part Question</SelectItem> */}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-text">Question Text *</Label>
                  <Textarea
                    id="edit-text"
                    value={questionForm.text}
                    onChange={(e) => handleQuestionTextChange(e.target.value)}
                    placeholder="Enter your question..."
                    required
                    rows={3}
                    className="mt-1"
                    spellCheck={true}
                  />
                </div>

                {/* Image Upload Section */}
                <div>
                  <Label>Question Image (Optional)</Label>
                  <div className="mt-2 space-y-3">
                    {imagePreview ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imagePreview}
                          alt="Question preview"
                          className="w-full max-h-64 object-contain rounded-lg border border-border"
                        />
                        <div className="flex gap-2 mt-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => document.getElementById('edit-image-upload').click()}
                          >
                            {/* eslint-disable-next-line jsx-a11y/alt-text */}
                            <Image className="w-4 h-4 mr-2" />
                            Replace Image
                          </Button>
                          {questionForm.image_url && !selectedImageFile ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleImageRemove(selectedQuestion.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete from Storage
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={clearImageSelection}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => document.getElementById('edit-image-upload').click()}
                        className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
                      >
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <Image className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm font-medium mb-1">Click to upload an image</p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG, GIF or WebP (max 5MB)
                        </p>
                      </div>
                    )}
                    <input
                      id="edit-image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </div>
                </div>

                {questionForm.type === "mcq" && (
                  <div>
                    <Label>Answer Options *</Label>
                    <div className="space-y-2 mt-2">
                      {questionForm.options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-medium text-blue-600 dark:text-blue-400">
                            {String.fromCharCode(65 + index)}
                          </span>
                          <Input
                            value={option}
                            onChange={(e) => handleOptionChange(index, e.target.value)}
                            placeholder={`Option ${index + 1}`}
                            className="flex-1 text-sm"
                            spellCheck={true}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* MCQ Multiple - Checkboxes for multiple correct answers */}
                {questionForm.type === "mcq_multiple" && (
                  <div className="space-y-4">
                    <div>
                      <Label>Answer Options *</Label>
                      <div className="space-y-2 mt-2">
                        {questionForm.options.map((option, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-medium text-green-600 dark:text-green-400">
                              {String.fromCharCode(65 + index)}
                            </span>
                            <Input
                              value={option}
                              onChange={(e) => handleOptionChange(index, e.target.value)}
                              placeholder={`Option ${index + 1}`}
                              className="flex-1 text-sm"
                              spellCheck={true}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Correct Answers * (Select all that apply)</Label>
                      <div className="space-y-2 mt-2 p-3 border rounded-lg">
                        {(questionForm.options || []).map((option, index) => {
                          const letter = String.fromCharCode(65 + index);
                          const isChecked = (questionForm.correct_option_ids || []).includes(letter);
                          return (
                            <div key={letter} className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                id={`edit-correct-${letter}`}
                                checked={isChecked}
                                onChange={(e) => {
                                  const currentIds = questionForm.correct_option_ids || [];
                                  const newCorrectIds = e.target.checked
                                    ? [...currentIds, letter]
                                    : currentIds.filter(id => id !== letter);
                                  setQuestionForm({...questionForm, correct_option_ids: newCorrectIds});
                                }}
                                className="h-4 w-4 text-green-600 focus:ring-green-500"
                              />
                              <Label htmlFor={`edit-correct-${letter}`} className="cursor-pointer flex-1">
                                {letter} - {option || "(empty)"}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Fill in the Blanks */}
                {questionForm.type === "fill_blank" && (
                  <div className="space-y-4">
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <strong>Auto-detection:</strong> Use <strong>___</strong> (three underscores) in your question text to mark blanks.
                        Blanks will be automatically detected and you can define correct answers for each below.
                      </p>
                    </div>
                    <div>
                      <Label>Blanks Configuration</Label>
                      <div className="space-y-3 mt-2">
                        {(questionForm.blanks || []).map((blank, index) => (
                          <div key={index} className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">Blank {index + 1}</span>
                            </div>
                            {blank.context && (
                              <div className="mb-3 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-xs font-mono">
                                <span className="text-gray-600 dark:text-gray-400">{blank.context.before}</span>
                                <span className="px-2 py-1 bg-yellow-300 dark:bg-yellow-600 text-yellow-900 dark:text-yellow-100 font-bold">___</span>
                                <span className="text-gray-600 dark:text-gray-400">{blank.context.after}</span>
                              </div>
                            )}
                            <div className="space-y-2">
                              <Input
                                placeholder="Correct answer (comma-separated for multiple)"
                                value={(blank.correct_answers || []).join(', ')}
                                onChange={(e) => {
                                  const newBlanks = [...(questionForm.blanks || [])];
                                  newBlanks[index].correct_answers = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                  setQuestionForm({...questionForm, blanks: newBlanks});
                                }}
                                className="text-sm"
                              />
                            </div>
                          </div>
                        ))}
                        {questionForm.blanks.length === 0 && (
                          <div className="text-center py-4 text-sm text-gray-500">
                            No blanks detected. Add <strong>___</strong> (three underscores) in your question text above.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Multi-Part Questions */}
                {questionForm.type === "multi_part" && (
                  <div className="space-y-4">
                    <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                      <p className="text-sm text-purple-800 dark:text-purple-200">
                        Create sub-questions (e.g., 1a, 1b, 1c) with different types (MCQ, Short, Long)
                      </p>
                    </div>
                    <div>
                      <Label>Sub-Questions</Label>
                      <div className="space-y-4 mt-2">
                        {(questionForm.sub_questions || []).map((subQ, index) => (
                          <div key={index} className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                            <div className="flex items-center justify-between mb-3">
                              <Input
                                placeholder="ID (e.g., 1a)"
                                value={subQ.id}
                                onChange={(e) => {
                                  const newSubQs = [...(questionForm.sub_questions || [])];
                                  newSubQs[index].id = e.target.value;
                                  setQuestionForm({...questionForm, sub_questions: newSubQs});
                                }}
                                className="w-24 text-sm"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newSubQs = (questionForm.sub_questions || []).filter((_, i) => i !== index);
                                  setQuestionForm({...questionForm, sub_questions: newSubQs});
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                            <div className="space-y-2">
                              <Select
                                value={subQ.type}
                                onValueChange={(value) => {
                                  const newSubQs = [...(questionForm.sub_questions || [])];
                                  newSubQs[index].type = value;
                                  setQuestionForm({...questionForm, sub_questions: newSubQs});
                                }}
                              >
                                <SelectTrigger className="text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="mcq">MCQ</SelectItem>
                                  <SelectItem value="short">Short</SelectItem>
                                  <SelectItem value="long">Long</SelectItem>
                                </SelectContent>
                              </Select>
                              <Textarea
                                placeholder="Sub-question text"
                                value={subQ.text}
                                onChange={(e) => {
                                  const newSubQs = [...(questionForm.sub_questions || [])];
                                  newSubQs[index].text = e.target.value;
                                  setQuestionForm({...questionForm, sub_questions: newSubQs});
                                }}
                                rows={2}
                                className="text-sm"
                              />
                              {subQ.type === 'mcq' && (
                                <>
                                  <div>
                                    <Label className="text-xs">Answer Options *</Label>
                                    <div className="space-y-2 mt-2">
                                      {['A', 'B', 'C', 'D'].map((letter, optIdx) => {
                                        const optionValue = subQ.options?.[letter] || '';
                                        return (
                                          <div key={letter} className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-xs font-medium text-purple-600 dark:text-purple-400">
                                              {letter}
                                            </span>
                                            <Input
                                              value={optionValue}
                                              onChange={(e) => {
                                                const newSubQs = [...(questionForm.sub_questions || [])];
                                                const currentOptions = newSubQs[index].options || {};
                                                newSubQs[index].options = {
                                                  ...currentOptions,
                                                  [letter]: e.target.value
                                                };
                                                setQuestionForm({...questionForm, sub_questions: newSubQs});
                                              }}
                                              placeholder={`Option ${letter}`}
                                              className="flex-1 text-xs"
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Correct Answer *</Label>
                                    <Select
                                      value={subQ.correct_option_id || ''}
                                      onValueChange={(value) => {
                                        const newSubQs = [...(questionForm.sub_questions || [])];
                                        newSubQs[index].correct_option_id = value;
                                        setQuestionForm({...questionForm, sub_questions: newSubQs});
                                      }}
                                    >
                                      <SelectTrigger className="mt-1 text-xs">
                                        <SelectValue placeholder="Select correct option" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {['A', 'B', 'C', 'D'].map((letter) => {
                                          const optionText = subQ.options?.[letter] || `Option ${letter}`;
                                          return (
                                            <SelectItem key={letter} value={letter}>
                                              {letter} - {optionText}
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </>
                              )}
                              {(subQ.type === 'short' || subQ.type === 'long') && (
                                <div>
                                  <Label className="text-xs">Correct Answer *</Label>
                                  <Textarea
                                    value={subQ.correct_answer || ''}
                                    onChange={(e) => {
                                      const newSubQs = [...(questionForm.sub_questions || [])];
                                      newSubQs[index].correct_answer = e.target.value;
                                      setQuestionForm({...questionForm, sub_questions: newSubQs});
                                    }}
                                    placeholder="Enter the correct answer or acceptable answer"
                                    rows={subQ.type === 'long' ? 4 : 2}
                                    className="text-xs mt-1"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const currentSubQs = questionForm.sub_questions || [];
                            setQuestionForm({
                              ...questionForm,
                              sub_questions: [...currentSubQs, { id: '', type: 'mcq', text: '', points: 1, options: { A: '', B: '', C: '', D: '' }, correct_option_id: null }]
                            });
                          }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Sub-Question
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Only show correct answer field for traditional question types */}
                {!["mcq_multiple", "fill_blank", "multi_part"].includes(questionForm.type) && (
                <div>
                  <Label htmlFor="edit-correct_answer">Correct Answer {questionForm.type === "mcq" && "*"}</Label>
                  {questionForm.type === "mcq" ? (
                    <div className="mt-1">
                      <Select
                        value={questionForm.correct_option_id || ""}
                        onValueChange={(value) => {
                          console.log("✅ Selected correct option:", value);
                          setQuestionForm({...questionForm, correct_option_id: value});
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select the correct option">
                            {questionForm.correct_option_id && (
                              <span>{questionForm.correct_option_id} - {questionForm.options[questionForm.correct_option_id.charCodeAt(0) - 65]}</span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {questionForm.options
                            .map((option, index) => {
                              const letter = String.fromCharCode(65 + index);
                              // Keep all 4 options even if empty, to maintain correct letter-to-index mapping
                              return (
                                <SelectItem key={letter} value={letter}>
                                  {letter} - {option || "(empty)"}
                                </SelectItem>
                              );
                            })}
                        </SelectContent>
                      </Select>
                      {questionForm.correct_option_id && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Selected: {questionForm.correct_option_id} - {questionForm.options[questionForm.correct_option_id.charCodeAt(0) - 65]}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Input
                      id="edit-correct_answer"
                      value={questionForm.correct_answer}
                      onChange={(e) => setQuestionForm({...questionForm, correct_answer: e.target.value})}
                      placeholder="Enter correct answer"
                      className="mt-1"
                      spellCheck={true}
                    />
                  )}
                </div>
                )}

                <div>
                  <Label htmlFor="edit-slide_number">Slide Number</Label>
                  <Input
                    id="edit-slide_number"
                    type="number"
                    value={questionForm.slide_number}
                    onChange={(e) => setQuestionForm({...questionForm, slide_number: e.target.value})}
                    placeholder="Optional"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-points">Points *</Label>
                  <Input
                    id="edit-points"
                    type="number"
                    step="0.1"
                    min="0"
                    value={questionForm.points}
                    onChange={(e) => setQuestionForm({...questionForm, points: e.target.value})}
                    placeholder="1.0"
                    required
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Points awarded for correct answer
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label htmlFor="edit-allow_critique" className="text-base font-medium">
                      Allow Feedback Critique
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Let students rate and comment on AI feedback for this question
                    </p>
                  </div>
                  <Switch
                    id="edit-allow_critique"
                    checked={questionForm.allow_critique}
                    onCheckedChange={(checked) => setQuestionForm({...questionForm, allow_critique: checked})}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-bloom_taxonomy">Bloom&apos;s Taxonomy</Label>
                  <Select value={questionForm.bloom_taxonomy} onValueChange={(value) => setQuestionForm({...questionForm, bloom_taxonomy: value})}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remember">Remember</SelectItem>
                      <SelectItem value="understand">Understand</SelectItem>
                      <SelectItem value="apply">Apply</SelectItem>
                      <SelectItem value="analyze">Analyze</SelectItem>
                      <SelectItem value="evaluate">Evaluate</SelectItem>
                      <SelectItem value="create">Create</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DrawerFooter className="border-t flex-shrink-0 bg-white dark:bg-gray-900">
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    Update Question
                  </Button>
                </div>
              </DrawerFooter>
            </form>
          </DrawerContent>
        </Drawer>
    </SidebarProvider>
  );
});

export default function QuestionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <QuestionsPageContent />
    </Suspense>
  );
}