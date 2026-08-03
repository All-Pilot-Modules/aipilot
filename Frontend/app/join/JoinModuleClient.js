'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Users, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/auth";
import ModuleConsentModal from "@/components/ModuleConsentModal";

export default function JoinModule() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [formData, setFormData] = useState({
    bannerId: '',
    accessCode: ''
  });

  // Consent modal state
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [enrolledModule, setEnrolledModule] = useState(null);

  const handleConsentSubmitted = (consentStatus) => {
    // Mark consent as submitted in both localStorage and sessionStorage
    if (enrolledModule) {
      // Store in localStorage (persists across sessions)
      const consentKey = `consent_${enrolledModule.id}_${formData.bannerId.trim()}`;
      localStorage.setItem(consentKey, 'true');
      console.log('✅ Consent saved to localStorage');

      // Also update sessionStorage
      const accessData = JSON.parse(sessionStorage.getItem('student_module_access') || '{}');
      accessData.consentSubmitted = true;
      accessData.consentStatus = consentStatus;
      sessionStorage.setItem('student_module_access', JSON.stringify(accessData));

      // Redirect to module
      router.push(`/student/module/${enrolledModule.id}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.bannerId.trim()) {
      setError('Please enter your Banner ID');
      return;
    }
    
    if (!formData.accessCode.trim()) {
      setError('Please enter an access code');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // First, search for module by access code
      const modules = await apiClient.get('/api/modules/all');
      // eslint-disable-next-line @next/next/no-assign-module-variable
      const module = modules.find(m => m.access_code === formData.accessCode.trim());
      
      if (!module) {
        setError('Invalid access code. Please check and try again.');
        return;
      }

      // Try to join the module (will succeed if already enrolled)

      // Enroll student in module
      await apiClient.post(`/api/student/join-module?access_code=${encodeURIComponent(formData.accessCode.trim())}&student_id=${encodeURIComponent(formData.bannerId.trim())}&module_id=${module.id}`);

      setSuccess('Successfully joined the module!');

      // Store access data in sessionStorage
      const accessData = {
        moduleId: module.id,
        moduleName: module.name,
        teacherName: module.teacher_name || 'Instructor',
        studentId: formData.bannerId.trim(),
        accessCode: formData.accessCode.trim(),
        accessTime: new Date().toISOString()
      };
      sessionStorage.setItem('student_module_access', JSON.stringify(accessData));

      // Check if module requires consent
      if (module.consent_required !== false) {
        // First, check if student has already consented
        const consentKey = `consent_${module.id}_${formData.bannerId.trim()}`;
        const storedConsent = localStorage.getItem(consentKey);

        if (storedConsent) {
          // Student has already consented, redirect directly
          console.log('✅ Consent already submitted (found in localStorage), redirecting...');
          setTimeout(() => {
            router.push(`/student/module/${module.id}`);
          }, 1500);
        } else {
          // Check via API if student has consented
          try {
            const consentResponse = await apiClient.get(
              `/api/modules/${module.id}/consent/${formData.bannerId.trim()}`
            );

            const { has_consented } = consentResponse;

            if (has_consented) {
              // Student has already consented in database, store in localStorage and redirect
              localStorage.setItem(consentKey, 'true');
              console.log('✅ Consent found in database, saved to localStorage, redirecting...');
              setTimeout(() => {
                router.push(`/student/module/${module.id}`);
              }, 1500);
            } else {
              // Student hasn't consented yet, show consent modal
              setEnrolledModule(module);
              setShowConsentModal(true);
            }
          } catch (consentError) {
            console.error('Failed to check consent status:', consentError);
            // If consent check fails, show the modal to be safe
            setEnrolledModule(module);
            setShowConsentModal(true);
          }
        }
      } else {
        // No consent required, redirect immediately
        setTimeout(() => {
          router.push(`/student/module/${module.id}`);
        }, 1500);
      }

    } catch (error) {
      console.error('Join module error:', error);

      // Provide user-friendly error messages
      if (error.response?.status === 404) {
        setError('Invalid access code. Please check with your instructor.');
      } else if (error.response?.status === 400) {
        setError('This module is not currently active. Please contact your instructor.');
      } else if (error.response?.status === 500) {
        setError('Server error. Please try again in a few moments.');
      } else if (error.message === 'Network Error' || !error.response) {
        setError('Network connection error. Please check your internet connection.');
      } else {
        setError(error.response?.data?.detail || error.message || 'Failed to join module. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Join a Module
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Enter your Banner ID and access code to join a learning module
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Student Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="bannerId">Banner ID</Label>
                <Input
                  id="bannerId"
                  type="text"
                  value={formData.bannerId}
                  onChange={(e) => setFormData({...formData, bannerId: e.target.value})}
                  placeholder="Enter your Banner ID (e.g., B00123456)"
                  required
                  className="mt-1"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This is your institutional student ID
                </p>
              </div>
              
              <div>
                <Label htmlFor="accessCode">Module Access Code</Label>
                <Input
                  id="accessCode"
                  type="text"
                  value={formData.accessCode}
                  onChange={(e) => setFormData({...formData, accessCode: e.target.value})}
                  placeholder="Enter the code provided by your instructor"
                  required
                  className="mt-1"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Get this from your instructor or course materials
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-green-700 dark:text-green-300">{success}</span>
                </div>
              )}

              <Button 
                type="submit" 
                disabled={loading || !formData.bannerId.trim() || !formData.accessCode.trim()} 
                className="w-full"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Joining Module...
                  </>
                ) : (
                  'Join Module'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-6 space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Do not have an access code? Contact your instructor.
          </p>
          <Button variant="outline" asChild>
            <Link href="/">← Back to Home</Link>
          </Button>
        </div>
      </div>

      {/* Consent Modal */}
      {showConsentModal && enrolledModule && (
        <ModuleConsentModal
          isOpen={showConsentModal}
          moduleId={enrolledModule.id}
          moduleName={enrolledModule.name}
          consentFormText={enrolledModule.consent_form_text}
          studentId={formData.bannerId.trim()}
          onConsentSubmitted={handleConsentSubmitted}
        />
      )}
    </div>
  );
}