'use client';

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Mail, Shield, Calendar, Save, Edit3, Camera, CheckCircle, AlertCircle, Loader2, ArrowLeft, Settings as SettingsIcon, Home } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/auth";

export default function ProfilePage() {
  const { user, loading, isAuthenticated, updateUser } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Update form data when user data loads
  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
      });
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl mb-4">Access Denied</h1>
            <p className="text-muted-foreground mb-4">Please sign in to access your profile</p>
            <Button asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSave = async () => {
    if (!formData.username.trim() || !formData.email.trim()) {
      setError('Username and email are required');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Call API to update user profile
      const response = await apiClient.put(`/api/users/${user.id}`, {
        username: formData.username.trim(),
        email: formData.email.trim(),
      });

      // Update the user in auth context
      if (updateUser) {
        updateUser(response);
      }

      setSuccess(true);
      setIsEditing(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError(err.response?.data?.detail || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') || localStorage.getItem('access_token') : null;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/users/${user.id}/profile-image`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to upload image');
      }

      const updated = await res.json();
      if (updateUser) updateUser(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleCancel = () => {
    // Reset form to original user data
    setFormData({
      username: user?.username || '',
      email: user?.email || '',
    });
    setIsEditing(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/')}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">Profile</h1>
                  <p className="text-xs text-muted-foreground">Manage your personal information</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/settings')}
                className="gap-2"
              >
                <SettingsIcon className="w-4 h-4" />
                Settings
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 ring-2 ring-indigo-100 dark:ring-indigo-900/50">
                  <AvatarImage src={user?.profile_image} alt={user?.username} />
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-sm">
                    {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block">
                  <p className="text-sm font-semibold">{user?.username || 'User'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-6">
            {/* Success Message */}
            {success && (
              <div className="mb-6 relative overflow-hidden rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 opacity-90"></div>
                <div className="relative p-4 text-white">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold">Profile Updated Successfully!</p>
                      <p className="text-sm text-white/90">Your changes have been saved.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 relative overflow-hidden rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-rose-500 to-red-500 opacity-90"></div>
                <div className="relative p-4 text-white">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold">Error Updating Profile</p>
                      <p className="text-sm text-white/90">{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="mb-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-500/5 dark:via-purple-500/5 dark:to-pink-500/5 rounded-2xl"></div>
              <div className="relative p-8 rounded-2xl border border-border/50 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <Avatar className="w-24 h-24 ring-4 ring-blue-100 dark:ring-blue-900/50">
                        <AvatarImage src={user?.profile_image} alt={user?.username} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-3xl font-bold">
                          {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                        title="Upload profile picture"
                      >
                        {uploadingImage ? (
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4 text-white" />
                        )}
                      </button>
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold text-foreground mb-1">
                        {user?.username || 'User Profile'}
                      </h1>
                      <p className="text-muted-foreground flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        {user?.role || 'Teacher'} Account
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setIsEditing(!isEditing)}
                    variant={isEditing ? "outline" : "default"}
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    {isEditing ? 'Cancel' : 'Edit Profile'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Profile Information */}
            <div className="grid gap-6">
              <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>Manage your account details and preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="username" className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Username
                      </Label>
                      <Input
                        id="username"
                        value={isEditing ? formData.username : user?.username || ''}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        disabled={!isEditing}
                        className={!isEditing ? 'bg-muted' : ''}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={isEditing ? formData.email : user?.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        disabled={!isEditing}
                        className={!isEditing ? 'bg-muted' : ''}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role" className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Account Role
                      </Label>
                      <Input
                        id="role"
                        value={user?.role || 'Teacher'}
                        disabled
                        className="bg-muted capitalize"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="joined" className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Member Since
                      </Label>
                      <Input
                        id="joined"
                        value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={handleCancel} disabled={saving}>
                        Cancel
                      </Button>
                      <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Account Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Modules Created</p>
                      <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">0</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Total Students</p>
                      <p className="text-3xl font-bold text-green-900 dark:text-green-100">0</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Documents</p>
                      <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">0</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
