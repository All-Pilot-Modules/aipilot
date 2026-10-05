'use client';

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Users, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { apiClient, auth } from "@/lib/auth";

export default function AccessAssignment() {
  const params = useParams();
  const router = useRouter();
  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    bannerId: '',
    accessCode: ''
  });

  const urlAccessCode = params.access_code;

  const fetchModule = useCallback(async () => {
    try {
      // Search for module by access code
      const modules = await apiClient.get('/api/modules/all');
      const foundModule = modules.find(m => m.access_code === urlAccessCode);

      if (foundModule) {
        setModule(foundModule);
      } else {
        setError('Module not found. Please check the access code.');
      }
    } catch (error) {
      console.error('Failed to fetch module:', error);
      setError('Failed to load module information.');
    } finally {
      setLoading(false);
    }
  }, [urlAccessCode]);

  useEffect(() => {
    if (urlAccessCode) {
      setFormData(prev => ({...prev, accessCode: urlAccessCode}));
      fetchModule();
    }
  }, [urlAccessCode, fetchModule]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.bannerId.trim() || !formData.accessCode.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Validate the access code with the backend and enroll this student.
      // student_id was previously never sent here, so this flow collected a
      // banner ID in the form but never actually enrolled the student —
      // fixed alongside wiring up the session token every other join flow
      // now returns.
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(
        `${API_BASE_URL}/api/student/join-module?access_code=${encodeURIComponent(formData.accessCode.trim())}&student_id=${encodeURIComponent(formData.bannerId.trim())}&module_id=${module.id}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Invalid access code');
      }

      const joinResult = await response.json();
      if (joinResult?.token) {
        auth.setStudentToken(joinResult.token);
      }

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
      
      // Redirect to module page
      router.push(`/student/module/${module.id}`);
      
    } catch (error) {
      console.error('Failed to access assignment:', error);
      setError(error.message || 'Failed to join module. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading module...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-md mx-auto px-6">
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Module Not Found</h3>
              <p className="text-gray-600 mb-6">{error}</p>
              <Button asChild>
                <Link href="/">Go Home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Access Assignment</h1>
          <p className="text-gray-600">Enter your details to access the assignment</p>
        </div>

        {module && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{module.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {module.description && (
                <p className="text-gray-600 text-sm">{module.description}</p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="bannerId">Banner ID</Label>
                <Input
                  id="bannerId"
                  type="text"
                  value={formData.bannerId}
                  onChange={(e) => setFormData({...formData, bannerId: e.target.value})}
                  placeholder="Enter your Banner ID"
                  required
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="accessCode">Access Code</Label>
                <Input
                  id="accessCode"
                  type="text"
                  value={formData.accessCode}
                  onChange={(e) => setFormData({...formData, accessCode: e.target.value})}
                  placeholder="Enter access code"
                  required
                  className="mt-1"
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Accessing...' : 'Access Assignment'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <Button variant="outline" asChild>
            <Link href="/">← Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}