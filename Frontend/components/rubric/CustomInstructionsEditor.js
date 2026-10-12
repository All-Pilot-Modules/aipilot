'use client';

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";

export default function CustomInstructionsEditor({ value, onChange }) {
  const examples = [
    "Focus on mathematical rigor and proper notation.",
    "Emphasize practical applications and real-world examples.",
    "Check for proper citations and evidence-based reasoning.",
    "Evaluate grammar, vocabulary, and natural expression.",
    "Prioritize conceptual understanding over memorization."
  ];

  const charCount = value?.length || 0;
  const maxChars = 500;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom Instructions</CardTitle>
          <CardDescription className="text-sm">
            Add specific guidance for AI feedback generation. These instructions will be included in every feedback prompt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Example: Focus on mathematical accuracy and proper methodology. Reference formulas from course materials."
              rows={6}
              maxLength={maxChars}
              className="resize-none"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Be specific about what you want the AI to emphasize</span>
              <span className={charCount > maxChars * 0.9 ? 'text-orange-600 dark:text-orange-300' : ''}>
                {charCount} / {maxChars}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Examples */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Example Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {examples.map((example, idx) => (
              <button
                key={idx}
                onClick={() => onChange(example)}
                className="w-full text-left p-2 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-xs text-blue-900 dark:text-blue-100 border border-blue-200 dark:border-blue-800"
              >
                {example}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
