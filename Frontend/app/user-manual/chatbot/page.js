'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  Settings,
  MessageCircle,
  FileText,
  Shield,
  Sliders,
  CheckCircle,
} from 'lucide-react';

export default function ChatbotPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Chatbot</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Configure the AI chatbot that helps students learn from your course materials.</p>
      </div>

      {/* What is the Chatbot */}
      <Card className="border-2 border-cyan-200 dark:border-cyan-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300">
            <Bot className="w-5 h-5" />
            What is the Student Chatbot?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>The AI chatbot is an interactive assistant that:</p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span>Answers student questions about course content</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span>Uses your uploaded documents as its knowledge base</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span>Provides explanations and clarifications</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
              <span>Helps students study and prepare for assessments</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Chatbot Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Chatbot Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Access chatbot configuration from <strong>Chatbot Settings</strong> in your module:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong>Enable/Disable</strong> - Turn the chatbot on or off for students</li>
            <li><strong>Welcome message</strong> - Customize the initial greeting</li>
            <li><strong>Response style</strong> - Adjust how the bot communicates</li>
            <li><strong>Knowledge scope</strong> - Control which documents the bot can access</li>
          </ul>
        </CardContent>
      </Card>

      {/* Custom Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600" />
            Custom Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Guide the chatbot&apos;s behavior with custom instructions:</p>
          <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <h4 className="font-medium text-purple-800 dark:text-purple-300 mb-2">Example Instructions:</h4>
            <ul className="text-sm text-purple-700 dark:text-purple-400 space-y-1 list-disc list-inside">
              <li>&quot;Always encourage students to think critically&quot;</li>
              <li>&quot;Don&apos;t give direct answers to assessment questions&quot;</li>
              <li>&quot;Provide examples from the course readings&quot;</li>
              <li>&quot;Use simple language for complex concepts&quot;</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Conversation Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            Conversation Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Choose how the chatbot interacts with students:</p>
          <div className="space-y-3 mt-3">
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">Tutor Mode</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Guides students with questions rather than giving direct answers</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">Assistant Mode</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Provides direct, helpful answers to student questions</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">Socratic Mode</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Responds primarily with questions to encourage deeper thinking</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Boundaries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-600" />
            Content Boundaries
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>Control what the chatbot can discuss:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong>On-topic only</strong> - Only answer questions related to course content</li>
            <li><strong>Citation required</strong> - Always cite sources from documents</li>
            <li><strong>No assessment answers</strong> - Refuse to directly answer graded questions</li>
          </ul>
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <strong>Tip:</strong> Setting clear boundaries helps maintain academic integrity while still providing valuable learning support.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Monitoring Conversations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600" />
            Monitoring Conversations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>You can review chatbot interactions:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li>View conversation history per student</li>
            <li>See common questions being asked</li>
            <li>Identify topics students struggle with</li>
            <li>Improve course materials based on chatbot insights</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
