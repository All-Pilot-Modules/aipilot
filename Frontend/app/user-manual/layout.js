'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Menu,
  X,
  BookOpen,
  Rocket,
  LayoutDashboard,
  FolderOpen,
  FileText,
  HelpCircle,
  ClipboardList,
  Users,
  CheckSquare,
  MessageSquare,
  Bot,
  BarChart3,
  Download,
  Wrench,
} from 'lucide-react';

const sections = [
  { href: '/user-manual', label: 'Introduction', icon: BookOpen },
  { href: '/user-manual/getting-started', label: 'Getting Started', icon: Rocket },
  { href: '/user-manual/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/user-manual/modules', label: 'Modules', icon: FolderOpen },
  { href: '/user-manual/documents', label: 'Documents', icon: FileText },
  { href: '/user-manual/questions', label: 'Questions', icon: HelpCircle },
  { href: '/user-manual/rubric', label: 'Rubric & Feedback Config', icon: ClipboardList },
  { href: '/user-manual/students', label: 'Students', icon: Users },
  { href: '/user-manual/grading', label: 'Grading', icon: CheckSquare },
  { href: '/user-manual/feedback', label: 'AI Feedback', icon: MessageSquare },
  { href: '/user-manual/chatbot', label: 'Chatbot', icon: Bot },
  { href: '/user-manual/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/user-manual/export', label: 'Data Export', icon: Download },
  { href: '/user-manual/troubleshooting', label: 'Troubleshooting', icon: Wrench },
];

export default function UserManualLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Dashboard</span>
              </Button>
            </Link>
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                Teacher&apos;s User Manual
              </h1>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-6 py-6">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:block w-64 flex-shrink-0">
          <nav className="sticky top-20 space-y-1 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = pathname === section.href;
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                  <span>{section.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Sidebar - Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <div className="fixed left-0 top-14 bottom-0 w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-y-auto p-4">
              <nav className="space-y-1">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const isActive = pathname === section.href;
                  return (
                    <Link
                      key={section.href}
                      href={section.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                      <span>{section.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
