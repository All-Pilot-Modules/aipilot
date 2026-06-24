"use client";

import Link from "next/link";
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  Brain,
  Users,
  Award,
  ChevronRight,
  ExternalLink,
  Plus,
  FileText,
  Calendar,
  Activity,
  BookOpen,
  Rocket,
  Settings,
  UserCircle,
  Loader2,
} from "lucide-react";
import { apiClient } from "@/lib/auth";

export default function DashboardPage({ user }) {
  const [modules, setModules] = useState([]);
  const [loadingModules, setLoadingModules] = useState(false);

  const fetchModules = useCallback(async () => {
    try {
      setLoadingModules(true);
      const teacherId = user?.id || user?.sub;
      if (!teacherId) return;
      const modulesData = await apiClient.get(`/api/modules?teacher_id=${teacherId}`);
      setModules(modulesData || []);
    } catch (error) {
      console.error('Failed to fetch modules:', error);
      setModules([]);
    } finally {
      setLoadingModules(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchModules();
  }, [user, fetchModules]);

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <main id="main-content" className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8 pb-8 border-b border-gray-200 dark:border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-muted-foreground mb-1">{greeting}</p>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground tracking-tight">{user?.username}</h1>
              <p className="text-sm text-gray-400 dark:text-muted-foreground mt-1">{user?.email}</p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/settings">
                  <Settings className="w-4 h-4 mr-2" />Settings
                </Link>
              </Button>
              <Button asChild size="sm" className="bg-gray-900 hover:bg-gray-700 text-white dark:bg-foreground dark:text-background">
                <Link href="/mymodules">
                  <Plus className="w-4 h-4 mr-2" />My Modules
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total modules', value: loadingModules ? '—' : modules.length, icon: BookOpen, href: '/mymodules' },
            { label: 'My modules',    value: 'Manage',  icon: Rocket,   href: '/mymodules' },
            { label: 'My profile',    value: 'View',    icon: UserCircle, href: '/profile' },
            { label: 'Resources',     value: 'Open',    icon: Brain,    href: 'https://brockportsigai.org', external: true },
          ].map(({ label, value, icon: Icon, href, external }) => (
            <Link key={label} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              <div className="bg-white dark:bg-card border border-gray-200 dark:border-border rounded-xl p-5 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all group cursor-pointer h-full">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 bg-gray-100 dark:bg-muted rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-gray-600 dark:text-muted-foreground" />
                  </div>
                  {external
                    ? <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    : <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-all" />}
                </div>
                <p className="text-xs text-gray-400 dark:text-muted-foreground mb-0.5">{label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-foreground">{value}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Modules list */}
          <section className="lg:col-span-2" aria-labelledby="modules-heading">
            <div className="flex items-center justify-between mb-4">
              <h2 id="modules-heading" className="text-lg font-semibold text-gray-900 dark:text-foreground">Your Modules</h2>
              {modules.length > 0 && (
                <Button asChild variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 dark:hover:text-foreground">
                  <Link href="/mymodules">
                    View all <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              )}
            </div>

            {loadingModules ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : modules.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {modules.slice(0, 4).map((moduleItem) => (
                  <Link key={moduleItem.id} href={`/dashboard?module=${encodeURIComponent(moduleItem.name)}`}>
                    <div className="group bg-white dark:bg-card border border-gray-200 dark:border-border rounded-xl p-5 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all cursor-pointer h-full">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-9 h-9 bg-gray-900 dark:bg-foreground rounded-lg flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-white dark:text-background" />
                        </div>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
                          Active
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-1 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors capitalize">
                        {moduleItem.name}
                      </h3>
                      <p className="text-xs text-gray-400 dark:text-muted-foreground line-clamp-2 mb-3">
                        {moduleItem.description || 'No description available'}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />{moduleItem.student_count || 0} students
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />{moduleItem.test_count || 0} tests
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 dark:border-border rounded-xl p-12 text-center">
                <div className="w-12 h-12 bg-gray-100 dark:bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Rocket className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-foreground mb-2">Create your first module</h3>
                <p className="text-sm text-gray-400 dark:text-muted-foreground mb-6 max-w-xs mx-auto">
                  Get started by creating a learning module to track student progress and generate AI insights.
                </p>
                <Button asChild size="sm" className="bg-gray-900 hover:bg-gray-700 text-white dark:bg-foreground dark:text-background">
                  <Link href="/mymodules">
                    <Plus className="mr-2 w-4 h-4" />Create your first module
                  </Link>
                </Button>
              </div>
            )}
          </section>

          {/* Sidebar */}
          <aside className="space-y-4" aria-label="Quick actions and information">

            {/* Quick Actions */}
            <Card className="border-gray-200 dark:border-border bg-white dark:bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-900 dark:text-foreground">Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                {[
                  { href: '/dashboard/students',  icon: Users,    label: 'Manage students'    },
                  { href: '/dashboard/questions', icon: FileText, label: 'Create assessment'   },
                  { href: '/dashboard/grading',   icon: Award,    label: 'Grade submissions'  },
                ].map(({ href, icon: Icon, label }) => (
                  <Button key={href} asChild variant="ghost" className="w-full justify-start text-sm text-gray-600 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground hover:bg-gray-50 dark:hover:bg-muted/20 h-9" size="sm">
                    <Link href={href}>
                      <Icon className="w-4 h-4 mr-2 shrink-0" />{label}
                    </Link>
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="border-gray-200 dark:border-border bg-white dark:bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-900 dark:text-foreground">Recent activity</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 text-sm">
                  {modules.length > 0 ? (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 bg-gray-100 dark:bg-muted rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Activity className="w-3.5 h-3.5 text-gray-500 dark:text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 dark:text-foreground text-xs">Module created</p>
                          <p className="text-gray-400 dark:text-muted-foreground text-xs capitalize">{modules[0]?.name || 'New module'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 bg-gray-100 dark:bg-muted rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-500 dark:text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 dark:text-foreground text-xs">Assessment due</p>
                          <p className="text-gray-400 dark:text-muted-foreground text-xs">Upcoming deadline in 3 days</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-400 dark:text-muted-foreground text-xs text-center py-3">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Getting Started */}
            <Card className="border-gray-200 dark:border-border bg-white dark:bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-900 dark:text-foreground">Getting started</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2 text-xs text-gray-500 dark:text-muted-foreground">
                  {[
                    'Create modules to organize your courses',
                    'Use AI to generate assessments',
                    'Track student progress in real-time',
                  ].map(tip => (
                    <li key={tip} className="flex items-start gap-2">
                      <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-300" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </aside>
        </div>

        {/* Platform Tools */}
        <section aria-labelledby="platform-tools-heading">
          <h2 id="platform-tools-heading" className="text-lg font-semibold text-gray-900 dark:text-foreground mb-4">Platform tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { href: '/settings',  icon: Settings,    label: 'Account Settings', desc: 'Manage your profile, preferences, and account configuration' },
              { href: '/profile',   icon: UserCircle,  label: 'My Profile',       desc: 'View and update your personal information and bio'           },
              { href: '/help',      icon: BookOpen,    label: 'Help Center',      desc: 'Get help, documentation, and support resources'             },
            ].map(({ href, icon: Icon, label, desc }) => (
              <Link key={href} href={href}>
                <Card className="border-gray-200 dark:border-border bg-white dark:bg-card hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all cursor-pointer h-full group">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-gray-100 dark:bg-muted rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-gray-200 dark:group-hover:bg-muted/60 transition-colors">
                        <Icon className="w-5 h-5 text-gray-600 dark:text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-0.5">{label}</h3>
                        <p className="text-xs text-gray-400 dark:text-muted-foreground leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <a href="https://brockportsigai.org" target="_blank" rel="noopener noreferrer" className="block mt-3">
            <Card className="border-gray-200 dark:border-border bg-white dark:bg-card hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all cursor-pointer group">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gray-100 dark:bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                    <Brain className="w-5 h-5 text-gray-600 dark:text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground">External Resources</h3>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-muted-foreground">Visit our research lab for additional learning materials</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </CardContent>
            </Card>
          </a>
        </section>

      </main>
    </div>
  );
}
