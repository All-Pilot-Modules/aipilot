'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  FileText,
  ListChecks,
  MessageSquare,
  CheckSquare,
  Type,
  GitBranch,
  FileQuestion
} from "lucide-react";

export default function QuestionTypeSettings({ value, onChange }) {
  const questionTypes = value?.question_type_settings || {};

  const handleTypeSettingChange = (type, setting, newValue) => {
    onChange({
      ...value,
      question_type_settings: {
        ...questionTypes,
        [type]: {
          ...questionTypes[type],
          [setting]: newValue
        }
      }
    });
  };

  const typeIcons = {
    mcq: <ListChecks className="w-5 h-5" />,
    short: <MessageSquare className="w-5 h-5" />,
    long: <FileText className="w-5 h-5" />,
    mcq_multiple: <CheckSquare className="w-5 h-5" />,
    fill_blank: <Type className="w-5 h-5" />,
    multi_part: <GitBranch className="w-5 h-5" />
  };

  const typeLabels = {
    mcq: "Multiple Choice (Single Answer)",
    short: "Short Answer",
    long: "Long Answer / Essay",
    mcq_multiple: "Multiple Choice (Multiple Answers)",
    fill_blank: "Fill in the Blanks",
    multi_part: "Multi-Part Questions"
  };

  return (
    <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/30 to-pink-50/20 dark:from-purple-950/20 dark:to-pink-950/10 shadow-lg">
      <CardHeader className="border-b-2 border-purple-200 dark:border-purple-700 bg-gradient-to-r from-purple-100/50 to-pink-100/50 dark:from-purple-900/40 dark:to-pink-900/30">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 shadow-lg">
            <FileQuestion className="w-6 h-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-purple-900 dark:text-purple-100">
              Question Type Settings
            </CardTitle>
            <CardDescription className="text-purple-800 dark:text-purple-300 mt-1">
              Configure grading behavior for different types of questions
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(typeLabels).map(([type, label]) => {
          const settings = questionTypes[type] || {};
          const defaultPoints = settings.default_points || 10;
          const minWords = settings.min_words || 0;
          const maxWords = settings.max_words || 1000;
          const strictness = settings.strictness || 0.7;
          const enabled = settings.enabled ?? true;

          return (
            <Card key={type} className="border-2 border-border hover:border-purple-400 dark:hover:border-purple-600 transition-all duration-300 bg-card shadow-md hover:shadow-lg">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40">
                      {typeIcons[type]}
                    </div>
                    <div>
                      <Label className="text-base font-bold text-slate-900 dark:text-foreground">{label}</Label>
                      <p className="text-xs text-slate-600 dark:text-muted-foreground mt-0.5">
                        Configure grading for {label.toLowerCase()} questions
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(val) => handleTypeSettingChange(type, 'enabled', val)}
                    className="scale-125"
                  />
                </div>

                {enabled && (
                  <div className="space-y-4 pt-4 border-t-2 border-border ">
                    <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-bold text-blue-900 dark:text-blue-100">Default Points</Label>
                        <Input
                          type="number"
                          value={defaultPoints}
                          onChange={(e) => handleTypeSettingChange(type, 'default_points', parseInt(e.target.value) || 0)}
                          min={0}
                          max={100}
                          className="w-28 h-10 text-center text-lg font-bold border-2 border-blue-300 dark:border-blue-700 focus:border-blue-500 "
                        />
                      </div>
                      <p className="text-xs text-blue-800 dark:text-blue-300 font-medium">
                        Default point value for this question type
                      </p>
                    </div>

                    <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-800">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-bold text-purple-900 dark:text-purple-100">
                          Grading Strictness
                        </Label>
                        <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-base px-4 py-1.5 border-0 shadow-md transition-transform hover:scale-105">
                          {(strictness * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="px-2 py-4">
                        <Slider
                          value={[strictness * 100]}
                          onValueChange={([val]) => handleTypeSettingChange(type, 'strictness', val / 100)}
                          min={0}
                          max={100}
                          step={1}
                          className="w-full cursor-grab active:cursor-grabbing"
                        />
                      </div>
                      <div className="flex justify-between text-xs font-medium text-purple-700 dark:text-purple-400 px-1">
                        <span className="flex flex-col items-start">
                          <span className="font-bold">0%</span>
                          <span className="text-[10px]">Lenient</span>
                        </span>
                        <span className="flex flex-col items-center">
                          <span className="font-bold">50%</span>
                          <span className="text-[10px]">Moderate</span>
                        </span>
                        <span className="flex flex-col items-end">
                          <span className="font-bold">100%</span>
                          <span className="text-[10px]">Strict</span>
                        </span>
                      </div>
                    </div>

                    {/* Special settings for Multiple Choice (Multiple Answers) */}
                    {type === 'mcq_multiple' && (
                      <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-2 border-orange-300 dark:border-orange-700">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 pr-4">
                            <Label className="text-sm font-bold text-orange-900 dark:text-orange-100">
                              Penalties on Wrong Answer
                            </Label>
                            <p className="text-xs text-orange-800 dark:text-orange-300 mt-1">
                              Deduct points for incorrect selections (-25% per wrong choice)
                            </p>
                          </div>
                          <Switch
                            checked={settings.penalty_for_wrong ?? true}
                            onCheckedChange={(val) => handleTypeSettingChange(type, 'penalty_for_wrong', val)}
                            className="scale-125"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}
