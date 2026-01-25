'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Upload,
  File,
  Bot,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
} from 'lucide-react';

export default function DocumentsPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Documents</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Upload course materials for AI processing, question generation, and chatbot training.</p>
      </div>

      {/* Uploading Documents */}
      <Card className="border-2 border-orange-200 dark:border-orange-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
            <Upload className="w-5 h-5" />
            Uploading Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>To upload course materials:</p>
          <ol className="space-y-3 list-decimal list-inside">
            <li>Navigate to the <strong>Documents</strong> section in your module</li>
            <li>Click the <strong>&quot;Upload Document&quot;</strong> button or drag and drop files</li>
            <li>Select one or more files from your computer</li>
            <li>Wait for the upload and processing to complete</li>
          </ol>
        </CardContent>
      </Card>

      {/* Supported Formats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <File className="w-5 h-5 text-blue-600" />
            Supported File Formats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>The following file formats are supported:</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline" className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
              PDF (.pdf)
            </Badge>
            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              Word (.docx)
            </Badge>
            <Badge variant="outline" className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              Text (.txt)
            </Badge>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Tip:</strong> For best results, use text-based PDFs rather than scanned images. The AI can extract and process text content more accurately.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AI Processing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-600" />
            AI Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>When you upload a document, the AI automatically:</p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span><strong>Extracts text content</strong> from the document</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span><strong>Creates embeddings</strong> for semantic search and the chatbot</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span><strong>Indexes content</strong> for question generation</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Processing Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            Processing Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Each document shows its processing status:</p>
          <div className="space-y-3 mt-3">
            <div className="flex items-center gap-3">
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">Processing</Badge>
              <span className="text-sm">Document is being analyzed by the AI</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Processed</Badge>
              <span className="text-sm">Document is ready for question generation</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Failed</Badge>
              <span className="text-sm">Processing failed - try re-uploading</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Managing Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            Managing Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>You can manage your uploaded documents:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong>View</strong> - Click on a document to see its details and extracted content</li>
            <li><strong>Delete</strong> - Remove documents you no longer need</li>
            <li><strong>Re-upload</strong> - Upload an updated version of a document</li>
          </ul>
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <strong>Note:</strong> Deleting a document will not remove questions that were already generated from it.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
