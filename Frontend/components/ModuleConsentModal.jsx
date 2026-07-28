'use client';

import { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle, Shield } from 'lucide-react';
import { apiClient } from '@/lib/auth';
import { DEFAULT_CONSENT_FORM } from '@/lib/consentForm';

export default function ModuleConsentModal({
  isOpen,
  moduleId,
  moduleName,
  consentFormText,
  studentId,
  onConsentSubmitted
}) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!selectedOption) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Use studentId prop or fallback to storage
      const sid = studentId || localStorage.getItem('student_id') || localStorage.getItem('user_id');

      await apiClient.put(`/api/modules/${moduleId}/consent/${sid}`, {
        waiver_status: selectedOption
      });

      // Close modal and notify parent
      if (onConsentSubmitted) {
        onConsentSubmitted(selectedOption);
      }
    } catch (err) {
      console.error('Failed to submit consent:', err);
      setError('Failed to submit consent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render consent text with basic markdown parsing
  const renderConsentText = (text) => {
    if (!text) return null;

    return text
      .split('\n')
      .map((line, index) => {
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-2xl font-bold mb-4 mt-6">{line.slice(2)}</h1>;
        } else if (line.startsWith('## ')) {
          return <h2 key={index} className="text-xl font-semibold mb-3 mt-4">{line.slice(3)}</h2>;
        } else if (line.startsWith('- ')) {
          return <li key={index} className="ml-6 mb-1">{line.slice(2)}</li>;
        } else if (line.trim() === '') {
          return <br key={index} />;
        } else {
          return <p key={index} className="mb-2 text-muted-foreground">{line}</p>;
        }
      });
  };

  return (
    <Drawer open={isOpen} onOpenChange={() => {}}>
      <DrawerContent className="max-w-4xl mx-auto max-h-[95vh]">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <DrawerTitle className="text-2xl">Research Consent Form</DrawerTitle>
              <DrawerDescription className="text-base">
                {moduleName} - Please review and provide your consent
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="space-y-6 py-4 px-6 overflow-y-auto max-h-[calc(95vh-180px)]">
          {/* Consent Form Text */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {renderConsentText(consentFormText || DEFAULT_CONSENT_FORM)}
          </div>

          {/* Consent Options */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-semibold">Please select one option:</h3>

            {/* Option 1: Agree */}
            <Card
              className={`cursor-pointer transition-all ${
                selectedOption === 1
                  ? 'border-green-500 border-2 bg-green-50 dark:bg-green-950/20'
                  : 'border-border hover:border-green-300'
              }`}
              onClick={() => setSelectedOption(1)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                    selectedOption === 1 ? 'border-green-500 bg-green-500' : 'border-muted-foreground'
                  }`}>
                    {selectedOption === 1 && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg mb-2">Yes</h4>
                    <p className="text-sm text-muted-foreground">
                      I agree to participate in this research project. I am 18 years of age or older.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Option 2: Do Not Agree */}
            <Card
              className={`cursor-pointer transition-all ${
                selectedOption === 2
                  ? 'border-orange-500 border-2 bg-orange-50 dark:bg-orange-950/20'
                  : 'border-border hover:border-orange-300'
              }`}
              onClick={() => setSelectedOption(2)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                    selectedOption === 2 ? 'border-orange-500 bg-orange-500' : 'border-muted-foreground'
                  }`}>
                    {selectedOption === 2 && <XCircle className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg mb-2">No</h4>
                    <p className="text-sm text-muted-foreground">
                      I do not agree to participate in this research project.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Option 3: Not Eligible */}
            <Card
              className={`cursor-pointer transition-all ${
                selectedOption === 3
                  ? 'border-red-500 border-2 bg-red-50 dark:bg-red-950/20'
                  : 'border-border hover:border-red-300'
              }`}
              onClick={() => setSelectedOption(3)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                    selectedOption === 3 ? 'border-red-500 bg-red-500' : 'border-muted-foreground'
                  }`}>
                    {selectedOption === 3 && <AlertCircle className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg mb-2">No</h4>
                    <p className="text-sm text-muted-foreground">
                      I am not eligible to participate as I am under the age of 18.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              onClick={handleSubmit}
              disabled={!selectedOption || isSubmitting}
              size="lg"
              className="w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Submit Response
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            By submitting, you acknowledge that you have read and understood this consent form.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
