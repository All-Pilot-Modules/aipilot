"use client"

import Link from 'next/link';
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { usePathname, useSearchParams } from 'next/navigation';

export function SiteHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const moduleName = searchParams?.get('module') || searchParams?.get('module_name');
  const params = new URLSearchParams();
  if (moduleName) params.set('module', moduleName);
  const titles = [
    ['questions/review', 'Review questions'], ['feedback-critiques', 'Feedback critiques'],
    ['documents', 'Documents'], ['questions', 'Questions'], ['grading', 'Grading'],
    ['students', 'Students'], ['analytics', 'Analytics'], ['rubric', 'AI feedback rubric'],
    ['chatbot-settings', 'Chatbot settings'], ['survey/responses', 'Survey responses'],
    ['survey', 'Survey settings'], ['settings', 'Settings'], ['help', 'Help'], ['search', 'Search'],
  ];
  const title = titles.find(([route]) => pathname.startsWith(`/dashboard/${route}`))?.[1] || 'Dashboard';

  return (
    <header className="flex min-h-14 shrink-0 items-center border-b bg-card">
      <div className="flex w-full min-w-0 items-center gap-2 px-3 sm:px-6">
        <SidebarTrigger className="shrink-0" />
        <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 py-3 text-sm">
          {pathname === '/dashboard' ? <span aria-current="page">Dashboard</span> : <>
            <Link className="text-muted-foreground hover:text-foreground hover:underline" href={`/dashboard?${params.toString()}`}>Dashboard</Link>
            <span aria-hidden="true" className="text-muted-foreground">/</span>
            <span aria-current="page" className="font-medium">{title}</span>
          </>}
          {moduleName && <span title={moduleName} className="max-w-full truncate rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{moduleName}</span>}
        </nav>
      </div>
    </header>
  );
}
