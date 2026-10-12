'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Zap, MessageSquare, BookOpen } from "lucide-react";

export default function RubricSummary({ rubric }) {
  if (!rubric) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No rubric configuration loaded
        </CardContent>
      </Card>
    );
  }

  const { grading_criteria, feedback_style, rag_settings, custom_instructions } = rubric;

  const criteriaCount = Object.keys(grading_criteria || {}).length;
  const tone = feedback_style?.tone || 'encouraging';
  const detailLevel = feedback_style?.detail_level || 'detailed';
  const ragEnabled = rag_settings?.enabled ?? true;

  const toneEmojis = {
    encouraging: '😊',
    neutral: '📊',
    strict: '🎯'
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Grading Criteria */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Grading Criteria</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {criteriaCount} criteria defined
              </p>
            </div>
          </div>

          {/* Feedback Style */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium flex items-center gap-1">
                {toneEmojis[tone]} {tone.charAt(0).toUpperCase() + tone.slice(1)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                {detailLevel} detail level
              </p>
            </div>
          </div>

          {/* RAG Status */}
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${
              ragEnabled
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-muted '
            }`}>
              <Zap className={`w-5 h-5 ${
                ragEnabled
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-400'
              }`} />
            </div>
            <div>
              <p className="text-sm font-medium">
                RAG {ragEnabled ? 'Enabled' : 'Disabled'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ragEnabled
                  ? `${rag_settings?.max_context_chunks || 3} chunks`
                  : 'No context retrieval'}
              </p>
            </div>
          </div>

          {/* Custom Instructions */}
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${
              custom_instructions
                ? 'bg-purple-100 dark:bg-purple-900/30'
                : 'bg-muted '
            }`}>
              <BookOpen className={`w-5 h-5 ${
                custom_instructions
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-gray-400'
              }`} />
            </div>
            <div>
              <p className="text-sm font-medium">Custom Instructions</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {custom_instructions ? 'Configured' : 'Not set'}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
