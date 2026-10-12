'use client';

import { Suspense } from "react"; // 👈 Add this
import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BarChart3, TrendingUp, Users, FileText, Clock, Download } from "lucide-react";
import Link from "next/link";

// ✅ Move logic using useSearchParams() to a separate inner component
function AnalyticsContent() {
  const { user, loading, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const moduleName = searchParams.get('module');

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl mb-4">Access Denied</h1>
        <Button asChild>
          <Link href="/sign-in">Sign In</Link>
        </Button>
      </div>
    );
  }

  if (!moduleName) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl mb-4">No Module Selected</h1>
        <Button asChild>
          <Link href="/mymodules">Go to My Modules</Link>
        </Button>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)"
      }}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="text-2xl font-bold">Analytics - {moduleName}</h1>
                    <p className="text-muted-foreground">
                      View performance analytics and insights
                    </p>
                  </div>
                  <Button>
                    <Download className="mr-2 w-4 h-4" />
                    Export Report
                  </Button>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Overall Performance</p>
                          <p className="text-2xl font-bold">-</p>
                          <p className="text-xs text-muted-foreground">No data yet</p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-300" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Completion Rate</p>
                          <p className="text-2xl font-bold">-</p>
                          <p className="text-xs text-muted-foreground">No submissions</p>
                        </div>
                        <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-300" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Active Students</p>
                          <p className="text-2xl font-bold">0</p>
                          <p className="text-xs text-muted-foreground">This week</p>
                        </div>
                        <Users className="w-8 h-8 text-purple-600 dark:text-purple-300" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Avg Time</p>
                          <p className="text-2xl font-bold">-</p>
                          <p className="text-xs text-muted-foreground">Per test</p>
                        </div>
                        <Clock className="w-8 h-8 text-orange-600 dark:text-orange-300" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Analytics Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Performance Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 flex items-center justify-center bg-muted rounded-lg">
                        <div className="text-center">
                          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">No data to display</p>
                          <p className="text-sm text-muted-foreground">Charts will appear when students complete tests</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Progress Trends
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 flex items-center justify-center bg-muted rounded-lg">
                        <div className="text-center">
                          <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">No trend data available</p>
                          <p className="text-sm text-muted-foreground">Trends will show as students progress</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-semibold mb-2">No recent activity</h3>
                      <p className="text-muted-foreground mb-4">
                        Activity will appear here when students start taking tests
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      AI-Generated Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-semibold mb-2">No insights available</h3>
                      <p className="text-muted-foreground mb-4">
                        AI insights will be generated based on student performance data
                      </p>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>• Performance pattern analysis</p>
                        <p>• Personalized learning recommendations</p>
                        <p>• Early intervention alerts</p>
                        <p>• Progress predictions</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

// ✅ Wrap your content with Suspense to fix build error
export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <AnalyticsContent />
    </Suspense>
  );
}