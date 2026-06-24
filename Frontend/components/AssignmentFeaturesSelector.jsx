'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, MessageCircle, Target, Settings, Info, Brain, Eye, EyeOff, PenLine } from "lucide-react";

const GRADING_MODES = [
  {
    value: 'ai_visible',
    label: 'AI Grading',
    sub: 'Score & feedback shown to student immediately',
    icon: Brain,
    color: 'blue',
  },
  {
    value: 'teacher_assist',
    label: 'AI Assists Teacher',
    sub: 'AI suggests grade to you; you approve before student sees anything',
    icon: Eye,
    color: 'purple',
  },
  {
    value: 'ai_teacher_only',
    label: 'Grade — Hide from Student',
    sub: 'AI grades automatically; result visible to teacher only',
    icon: EyeOff,
    color: 'amber',
  },
  {
    value: 'manual',
    label: 'Manual Grading',
    sub: 'Teacher reviews and grades each answer themselves',
    icon: PenLine,
    color: 'gray',
  },
];

const ATTEMPT_MODE_OPTIONS = [
  { value: 'ai_visible',      label: 'AI → Show student' },
  { value: 'teacher_assist',  label: 'AI → Teacher approves' },
  { value: 'ai_teacher_only', label: 'AI → Teacher only' },
  { value: 'manual',          label: 'Manual' },
];

export default function AssignmentFeaturesSelector({ value, onChange }) {
  const defaultConfig = {
    grading: {
      mode: 'ai_visible',
      per_attempt_enabled: false,
      attempt_modes: {},
    },
    features: {
      multiple_attempts: {
        enabled: true,
        max_attempts: 2,
        show_feedback_after_each: true
      },
      chatbot_feedback: {
        enabled: true,
        conversation_mode: "guided",
        ai_model: "gpt-4"
      },
      mastery_learning: {
        enabled: true,
        streak_required: 3,
        queue_randomization: true,
        reset_on_wrong: false
      }
    },
    display_settings: {
      show_progress_bar: true,
      show_streak_counter: true,
      show_attempt_counter: true
    }
  };

  const config = value
    ? { grading: defaultConfig.grading, ...value }
    : defaultConfig;

  // ensure grading block always exists
  if (!config.grading) config.grading = { ...defaultConfig.grading };

  const updateConfig = (path, newValue) => {
    const newConfig = JSON.parse(JSON.stringify(config));
    const keys = path.split('.');
    let current = newConfig;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = newValue;
    onChange(newConfig);
  };

  const setGradingMode = (mode) => {
    const newConfig = JSON.parse(JSON.stringify(config));
    newConfig.grading = { ...newConfig.grading, mode, attempt_modes: {} };
    // manual grading → disable per-attempt (no point)
    if (mode === 'manual') newConfig.grading.per_attempt_enabled = false;
    onChange(newConfig);
  };

  const setAttemptMode = (attempt, mode) => {
    const newConfig = JSON.parse(JSON.stringify(config));
    newConfig.grading.attempt_modes = { ...newConfig.grading.attempt_modes, [attempt]: mode };
    onChange(newConfig);
  };

  const maxAttempts = config.features?.multiple_attempts?.max_attempts || 2;
  const attemptsEnabled = config.features?.multiple_attempts?.enabled;

  const getEnabledFeatures = () => {
    const features = [];
    const g = config.grading;
    if (g?.mode === 'ai_visible')      features.push('AI Grading');
    if (g?.mode === 'teacher_assist')  features.push('AI Assists Teacher');
    if (g?.mode === 'ai_teacher_only') features.push('AI (Hidden from Student)');
    if (g?.mode === 'manual')          features.push('Manual Grading');
    if (config.features?.multiple_attempts?.enabled) features.push('Multiple Attempts');
    if (config.features?.chatbot_feedback?.enabled)  features.push('AI Chatbot');
    if (config.features?.mastery_learning?.enabled)  features.push('Mastery Learning');
    return features;
  };

  return (
    <Card className="sticky top-6">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <CardTitle className="text-lg">Assignment Features</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure how students interact with assignments
        </p>
        {getEnabledFeatures().length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-2">
            <span className="text-xs text-muted-foreground">Active:</span>
            {getEnabledFeatures().map((feature) => (
              <Badge key={feature} variant="secondary" className="text-xs">
                {feature}
              </Badge>
            ))}
          </div>
        ) : (
          <Badge variant="outline" className="text-xs mt-2">Standard Mode</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">

        {/* ── Grading Mode ─────────────────────────────────── */}
        <div className="border rounded-lg p-4 bg-blue-50/50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-blue-600" />
            <h4 className="font-medium text-sm">Grading Mode</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Choose how student answers are graded
          </p>

          <div className="space-y-2">
            {GRADING_MODES.map(({ value: mv, label, sub, icon: Icon, color }) => {
              const active = config.grading.mode === mv;
              const colorMap = {
                blue:   'border-blue-500 bg-blue-50 dark:bg-blue-950/30',
                purple: 'border-purple-500 bg-purple-50 dark:bg-purple-950/30',
                amber:  'border-amber-500 bg-amber-50 dark:bg-amber-950/30',
                gray:   'border-gray-400 bg-gray-50 dark:bg-gray-900/30',
              };
              const iconMap = {
                blue:   'text-blue-600',
                purple: 'text-purple-600',
                amber:  'text-amber-600',
                gray:   'text-gray-500',
              };
              return (
                <button
                  key={mv}
                  type="button"
                  onClick={() => setGradingMode(mv)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                    active ? colorMap[color] : 'border-transparent bg-muted/30 hover:bg-muted/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${active ? iconMap[color] : 'text-muted-foreground'}`} />
                  <div>
                    <p className={`text-xs font-semibold ${active ? '' : 'text-muted-foreground'}`}>{label}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                  {active && (
                    <div className={`ml-auto w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                      color === 'blue' ? 'bg-blue-500' :
                      color === 'purple' ? 'bg-purple-500' :
                      color === 'amber' ? 'bg-amber-500' : 'bg-gray-400'
                    }`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Per-attempt override — only shown when AI mode + multiple attempts on */}
          {config.grading.mode !== 'manual' && attemptsEnabled && maxAttempts > 1 && (
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium">Configure per attempt</Label>
                <Switch
                  checked={config.grading.per_attempt_enabled}
                  onCheckedChange={(v) => updateConfig('grading.per_attempt_enabled', v)}
                />
              </div>
              {config.grading.per_attempt_enabled && (
                <div className="space-y-2 mt-2">
                  {Array.from({ length: maxAttempts }, (_, i) => i + 1).map((attempt) => {
                    const current = config.grading.attempt_modes?.[attempt] || config.grading.mode;
                    return (
                      <div key={attempt} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-20 flex-shrink-0">Attempt {attempt}</span>
                        <Select value={current} onValueChange={(v) => setAttemptMode(attempt, v)}>
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ATTEMPT_MODE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value} className="text-xs">
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Multiple Attempts */}
        <div className="border rounded-lg p-4 bg-orange-50/50 dark:bg-orange-950/10 border-orange-200 dark:border-orange-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-orange-600" />
              <h4 className="font-medium text-sm">Multiple Attempts</h4>
            </div>
            <Switch
              checked={config.features.multiple_attempts.enabled}
              onCheckedChange={(checked) => updateConfig('features.multiple_attempts.enabled', checked)}
            />
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Students can retry questions with feedback between attempts
          </p>
          {config.features.multiple_attempts.enabled && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="max-attempts" className="text-xs">Max Attempts</Label>
                  <Input
                    id="max-attempts"
                    type="number"
                    min="1"
                    max="5"
                    value={config.features.multiple_attempts.max_attempts}
                    onChange={(e) => updateConfig('features.multiple_attempts.max_attempts', parseInt(e.target.value))}
                    className="mt-1 h-8"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-4">
                  <Switch
                    id="show-feedback"
                    checked={config.features.multiple_attempts.show_feedback_after_each}
                    onCheckedChange={(checked) => updateConfig('features.multiple_attempts.show_feedback_after_each', checked)}
                  />
                  <Label htmlFor="show-feedback" className="text-xs">Show feedback</Label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Chatbot */}
        <div className="border rounded-lg p-4 bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-600" />
              <h4 className="font-medium text-sm">AI Chatbot</h4>
            </div>
            <Switch
              checked={config.features.chatbot_feedback.enabled}
              onCheckedChange={(checked) => updateConfig('features.chatbot_feedback.enabled', checked)}
            />
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Interactive AI conversations to guide student improvement
          </p>
          {config.features.chatbot_feedback.enabled && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="opacity-50">
                  <Label className="text-xs flex items-center gap-1">
                    Mode
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">Soon</Badge>
                  </Label>
                  <Select
                    value={config.features.chatbot_feedback.conversation_mode}
                    disabled={true}
                  >
                    <SelectTrigger className="mt-1 h-8" disabled>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guided">Guided</SelectItem>
                      <SelectItem value="free_form">Free-form</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="opacity-50">
                  <Label className="text-xs flex items-center gap-1">
                    AI Model
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">Soon</Badge>
                  </Label>
                  <Select
                    value={config.features.chatbot_feedback.ai_model}
                    disabled={true}
                  >
                    <SelectTrigger className="mt-1 h-8" disabled>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-3.5">GPT-3.5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mastery Learning */}
        <div className={`border rounded-lg p-4 border-purple-200 dark:border-purple-800 ${config.features.mastery_learning.enabled ? 'bg-purple-50/50 dark:bg-purple-950/10' : 'bg-gray-50/50 dark:bg-gray-950/10'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-600" />
              <h4 className="font-medium text-sm">Mastery Learning</h4>
            </div>
            <Switch
              checked={config.features.mastery_learning.enabled}
              onCheckedChange={(checked) => updateConfig('features.mastery_learning.enabled', checked)}
            />
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Repeat questions until students achieve consecutive correct answers
          </p>
          {config.features.mastery_learning.enabled && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="streak-required" className="text-xs">Streak Required</Label>
                  <Input
                    id="streak-required"
                    type="number"
                    min="1"
                    max="10"
                    value={config.features.mastery_learning.streak_required}
                    onChange={(e) => updateConfig('features.mastery_learning.streak_required', parseInt(e.target.value))}
                    className="mt-1 h-8"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="randomize-queue"
                      checked={config.features.mastery_learning.queue_randomization}
                      onCheckedChange={(checked) => updateConfig('features.mastery_learning.queue_randomization', checked)}
                    />
                    <Label htmlFor="randomize-queue" className="text-xs">Randomize order</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="reset-streak"
                      checked={config.features.mastery_learning.reset_on_wrong}
                      onCheckedChange={(checked) => updateConfig('features.mastery_learning.reset_on_wrong', checked)}
                    />
                    <Label htmlFor="reset-streak" className="text-xs">Reset on wrong</Label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feature Interaction Info */}
        {getEnabledFeatures().length > 1 && (
          <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <Info className="w-3 h-3 text-amber-600 mt-0.5" />
              <div>
                <h5 className="font-medium text-amber-900 dark:text-amber-100 text-xs">Feature Interaction</h5>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  {config.features.multiple_attempts.enabled && config.features.chatbot_feedback.enabled && 
                   "AI feedback between attempts. "}
                  {config.features.chatbot_feedback.enabled && config.features.mastery_learning.enabled && 
                   "AI guidance before queue retry. "}
                  {config.features.multiple_attempts.enabled && config.features.mastery_learning.enabled && 
                   "Multiple attempts before streak impact."}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}