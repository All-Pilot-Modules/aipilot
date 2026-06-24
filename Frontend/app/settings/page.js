'use client';

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Settings as SettingsIcon,
  Shield,
  Palette,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Save,
  Key,
  Moon,
  Sun,
  Monitor,
  AlertTriangle,
  ArrowLeft,
  User,
  Camera,
  CheckCircle,
  Calendar
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/auth";

export default function SettingsPage() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  // User account data (only fields that exist in database)
  const [userData, setUserData] = useState({
    username: '',
    email: '',
    profile_image: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Load user data when component mounts
  useEffect(() => {
    if (user) {
      setUserData({
        username: user.username || '',
        email: user.email || '',
        profile_image: user.profile_image || '',
      });
    }
  }, [user]);

  const handleUserDataChange = (field, value) => {
    setUserData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-gray-800/30 to-gray-900/20 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-gray-800/30 to-gray-900/20 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl mb-4">Access Denied</h1>
            <p className="text-muted-foreground mb-4">Please sign in to access settings</p>
            <Button asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const userId = user?.id || user?.sub;

      // Update user data via API (all editable fields from database)
      await apiClient.put(`/api/users/${userId}`, {
        username: userData.username,
        email: userData.email,
        profile_image: userData.profile_image,
      });

      console.log('Settings saved successfully');
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match!');
      return;
    }

    try {
      setSavingPassword(true);
      const userId = user?.id || user?.sub;

      // TODO: Implement password change API
      await apiClient.put(`/api/users/${userId}/password`, {
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword,
      });

      alert('Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    } catch (error) {
      console.error('Failed to change password:', error);
      alert('Failed to change password. Please try again.');
    } finally {
      setSavingPassword(false);
    }
  };

  // Calculate account age
  const getAccountAge = () => {
    if (!user?.created_at) return 'N/A';
    const created = new Date(user.created_at);
    const now = new Date();
    const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    return `${Math.floor(days / 365)} years`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-800/30 to-gray-900/20 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
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
                <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center shadow-lg">
                  <SettingsIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">Settings</h1>
                  <p className="text-xs text-muted-foreground">Manage your account</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/profile')}
                className="gap-2"
              >
                <User className="w-4 h-4" />
                Profile
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 ring-2 ring-blue-100 dark:ring-blue-900/50">
                  <AvatarImage src={user?.profile_image} alt={user?.username} />
                  <AvatarFallback className="bg-gray-900 text-white font-semibold text-sm">
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
      <div className="max-w-6xl mx-auto px-6 py-8">
            {/* Profile Hero Card */}
            <div className="mb-8 relative overflow-hidden rounded-3xl">
              <div className="absolute inset-0 bg-gray-900 opacity-90"></div>
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30"></div>
              <div className="relative p-10 text-white">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                  <div className="relative group">
                    <Avatar className="w-32 h-32 ring-4 ring-white/30 shadow-2xl">
                      <AvatarImage src={user?.profile_image} alt={user?.username} />
                      <AvatarFallback className="bg-white/20 backdrop-blur-sm text-4xl font-bold text-white">
                        {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <button className="absolute bottom-2 right-2 w-10 h-10 bg-white text-gray-700 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                      <Camera className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start mb-3">
                      <h1 className="text-4xl font-bold">{user?.username || 'User'}</h1>
                      <Badge className="bg-white/20 backdrop-blur-sm border-white/30 text-white font-semibold px-3 py-1">
                        {user?.role?.toUpperCase() || 'USER'}
                      </Badge>
                      {user?.is_email_verified ? (
                        <Badge className="bg-emerald-500/30 backdrop-blur-sm border-emerald-300/50 text-white font-semibold px-3 py-1 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/30 backdrop-blur-sm border-amber-300/50 text-white font-semibold px-3 py-1 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          Unverified
                        </Badge>
                      )}
                    </div>
                    <p className="text-white/90 text-lg mb-2">{user?.email || 'No email set'}</p>
                    <p className="text-white/70 text-sm">Member for {getAccountAge()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="relative overflow-hidden rounded-2xl bg-gray-900 p-6 shadow-lg">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-white/80 mb-1">Account Status</p>
                  <p className="text-3xl font-bold text-white">{user?.is_active ? 'Active' : 'Inactive'}</p>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 shadow-lg">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      {user?.is_email_verified ? (
                        <CheckCircle className="w-6 h-6 text-white" />
                      ) : (
                        <Mail className="w-6 h-6 text-white" />
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-white/80 mb-1">Email Status</p>
                  <p className="text-3xl font-bold text-white">{user?.is_email_verified ? 'Verified' : 'Not Verified'}</p>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl bg-gray-900 p-6 shadow-lg">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-white/80 mb-1">Member Since</p>
                  <p className="text-3xl font-bold text-white">{getAccountAge()}</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Account Information */}
              <Card className="border-border bg-card/50 backdrop-blur-sm shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" />
                        Account Information
                      </CardTitle>
                      <CardDescription>Update your username and email address</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Editable Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="username" className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Username *
                      </Label>
                      <Input
                        id="username"
                        value={userData.username}
                        onChange={(e) => handleUserDataChange('username', e.target.value)}
                        placeholder="Enter username"
                        className="font-medium"
                      />
                      <p className="text-xs text-muted-foreground">This is how others will see you on the platform</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email Address *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={userData.email}
                        onChange={(e) => handleUserDataChange('email', e.target.value)}
                        placeholder="Enter email"
                        className="font-medium"
                      />
                      <p className="text-xs text-muted-foreground">
                        {user?.is_email_verified ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Email verified
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Email not verified
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile_image" className="flex items-center gap-2">
                        <Camera className="w-4 h-4" />
                        Profile Image URL
                      </Label>
                      <Input
                        id="profile_image"
                        value={userData.profile_image}
                        onChange={(e) => handleUserDataChange('profile_image', e.target.value)}
                        placeholder="Enter image URL"
                        className="font-medium"
                      />
                      <p className="text-xs text-muted-foreground">Enter a URL to your profile picture</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Read-Only Fields */}
                  <div>
                    <Label className="text-base mb-3 block font-semibold">Account Details (Read-Only)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="user_id" className="flex items-center gap-2 text-muted-foreground">
                          <Shield className="w-4 h-4" />
                          User ID (Banner ID)
                        </Label>
                        <Input
                          id="user_id"
                          value={user?.id || 'N/A'}
                          disabled
                          className="bg-muted font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role" className="flex items-center gap-2 text-muted-foreground">
                          <Shield className="w-4 h-4" />
                          Account Role
                        </Label>
                        <Input
                          id="role"
                          value={user?.role || 'N/A'}
                          disabled
                          className="bg-muted capitalize"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="is_active" className="flex items-center gap-2 text-muted-foreground">
                          <CheckCircle className="w-4 h-4" />
                          Account Active Status
                        </Label>
                        <Input
                          id="is_active"
                          value={user?.is_active ? 'Active' : 'Inactive'}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="is_email_verified_field" className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          Email Verification Status
                        </Label>
                        <Input
                          id="is_email_verified_field"
                          value={user?.is_email_verified ? 'Verified' : 'Not Verified'}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-end">
                    <Button onClick={handleSaveSettings} disabled={saving}>
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
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
                </CardContent>
              </Card>

              {/* Security & Password */}
              <Card className="border-border bg-card/50 backdrop-blur-sm shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Security & Password
                  </CardTitle>
                  <CardDescription>Manage your password and security settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Key className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Password</p>
                        <p className="text-sm text-muted-foreground">Last updated: {user?.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'Never'}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPasswordForm(!showPasswordForm)}
                    >
                      {showPasswordForm ? 'Cancel' : 'Change Password'}
                    </Button>
                  </div>

                  {showPasswordForm && (
                    <div className="space-y-4 p-4 border rounded-lg bg-background">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <div className="relative">
                          <Input
                            id="currentPassword"
                            type="password"
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                            placeholder="Enter current password"
                          />
                          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <div className="relative">
                          <Input
                            id="newPassword"
                            type="password"
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                            placeholder="Enter new password"
                          />
                          <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            type="password"
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                            placeholder="Confirm new password"
                          />
                          <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                      <Button
                        onClick={handlePasswordChange}
                        disabled={savingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                        className="w-full"
                      >
                        {savingPassword ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Updating Password...
                          </>
                        ) : (
                          <>
                            <Key className="w-4 h-4 mr-2" />
                            Update Password
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  <Separator />

                  {/* Account Timestamps */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-blue-950/30">
                      <Calendar className="w-5 h-5 text-gray-700 dark:text-gray-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Account Created</p>
                        <p className="text-sm font-medium">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-950/30">
                      <Calendar className="w-5 h-5 text-gray-700 dark:text-gray-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Last Updated</p>
                        <p className="text-sm font-medium">{user?.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Appearance */}
              <Card className="border-border bg-card/50 backdrop-blur-sm shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Palette className="w-5 h-5 text-primary" />
                    Appearance
                  </CardTitle>
                  <CardDescription>Customize how the app looks on your device</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label className="text-base mb-3 block">Theme</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <button
                        onClick={() => setTheme('light')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          theme === 'light'
                            ? 'border-primary bg-primary/10 shadow-md'
                            : 'border-border hover:border-primary/50 hover:shadow-sm'
                        }`}
                      >
                        <Sun className={`w-6 h-6 mx-auto mb-2 ${theme === 'light' ? 'text-primary' : ''}`} />
                        <p className="text-sm font-medium">Light</p>
                        {theme === 'light' && <p className="text-xs text-muted-foreground mt-1">Active</p>}
                      </button>
                      <button
                        onClick={() => setTheme('dark')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          theme === 'dark'
                            ? 'border-primary bg-primary/10 shadow-md'
                            : 'border-border hover:border-primary/50 hover:shadow-sm'
                        }`}
                      >
                        <Moon className={`w-6 h-6 mx-auto mb-2 ${theme === 'dark' ? 'text-primary' : ''}`} />
                        <p className="text-sm font-medium">Dark</p>
                        {theme === 'dark' && <p className="text-xs text-muted-foreground mt-1">Active</p>}
                      </button>
                      <button
                        onClick={() => setTheme('system')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          theme === 'system'
                            ? 'border-primary bg-primary/10 shadow-md'
                            : 'border-border hover:border-primary/50 hover:shadow-sm'
                        }`}
                      >
                        <Monitor className={`w-6 h-6 mx-auto mb-2 ${theme === 'system' ? 'text-primary' : ''}`} />
                        <p className="text-sm font-medium">System</p>
                        {theme === 'system' && <p className="text-xs text-muted-foreground mt-1">Active</p>}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
    </div>
  );
}
