'use client';

import { useState } from 'react';
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Check } from "lucide-react";

export default function RubricQuickSelector({ value, onChange }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const templates = [
    { key: 'default', name: 'General Purpose', hint: 'Balanced grading for any subject' },
    { key: 'stem_course', name: 'STEM / Science', hint: 'Precision & step-by-step reasoning' },
    { key: 'humanities', name: 'Humanities', hint: 'Argument quality & analysis' },
    { key: 'language_learning', name: 'Language', hint: 'Fluency, grammar & usage' },
    { key: 'professional_skills', name: 'Professional', hint: 'Real-world, workplace-style feedback' },
    { key: 'strict_grading', name: 'Strict / Exam Prep', hint: 'Rigorous, exam-style scoring' }
  ];

  const selectedTemplate = templates.find(t => t.key === value) || templates[0];

  const handleTemplateSelect = (templateKey) => {
    onChange(templateKey);
    setIsExpanded(false);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Feedback Rubric Template</Label>
        <span className="text-[11px] text-muted-foreground">Customizable later</span>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm tracking-tight truncate">{selectedTemplate.name}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
              Template
            </Badge>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {isExpanded && (
          <div className="border-t divide-y">
            {templates.map((template) => (
              <button
                key={template.key}
                type="button"
                onClick={() => handleTemplateSelect(template.key)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                  selectedTemplate.key === template.key
                    ? 'bg-primary/10'
                    : 'hover:bg-muted/50'
                }`}
              >
                <span className="min-w-0">
                  <span className={`block text-sm leading-tight font-medium ${selectedTemplate.key === template.key ? 'text-primary' : ''}`}>
                    {template.name}
                  </span>
                  <span className="block text-[11px] text-muted-foreground leading-tight truncate">{template.hint}</span>
                </span>
                {selectedTemplate.key === template.key && (
                  <Check className="w-3.5 h-3.5 text-primary ml-auto shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
