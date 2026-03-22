"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useMemo } from "react";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";

import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, User, ChevronDown, LayoutDashboard, FolderOpen, HelpCircle, Users, BookOpen, ClipboardCheck, Sparkles, Shield, Brain, FileText, BarChart3, LifeBuoy, MessageSquare } from "lucide-react";
import { useAPI } from "@/lib/useSWR";

export function AppSidebar(props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Check for 'module' param first, fall back to 'module_name' (used in review page)
  // Use empty string as default to ensure consistent rendering
  // eslint-disable-next-line @next/next/no-assign-module-variable
  const module = searchParams?.get('module') || searchParams?.get('module_name') || '';

  const { user, logout } = useAuth();
  const userId = user?.id || user?.sub;

  // Use SWR — shares cache with all dashboard pages (300s dedup = zero extra requests)
  const { data: modulesRaw, isLoading: loadingModules } = useAPI(
    userId ? `/api/modules?teacher_id=${userId}` : null,
    { dedupingInterval: 300000 }
  );
  const modules = useMemo(() => modulesRaw?.data || modulesRaw || [], [modulesRaw]);

  // Derive currentModuleId — prefer URL param (already set by dashboard links), fall back to name lookup
  const currentModuleId = useMemo(() => {
    const idFromParam = searchParams?.get('moduleId');
    if (idFromParam) return idFromParam;
    if (module && modules.length > 0) {
      return modules.find(m => m.name === module)?.id || null;
    }
    return null;
  }, [searchParams, module, modules]);

  const handleModuleSwitch = (moduleName, moduleId) => {
    const currentPath = pathname.split('?')[0];
    const params = moduleId ? `module=${moduleName}&moduleId=${moduleId}` : `module=${moduleName}`;
    router.push(`${currentPath}?${params}`);
  };

  const isActive = (url) => {
    const path = url.split('?')[0];
    if (path === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(path);
  };

  // Memoize navMain to prevent hydration issues
  const moduleParams = module
    ? `module=${module}${currentModuleId ? `&moduleId=${currentModuleId}` : ''}`
    : '';
  const navMain = useMemo(() => [
    {
      title: "Dashboard",
      url: `/dashboard?${moduleParams}`,
      icon: LayoutDashboard,
    },
    {
      title: "Documents",
      url: `/dashboard/documents?${moduleParams}`,
      icon: FolderOpen,
    },
    {
      title: "Questions",
      url: `/dashboard/questions?${moduleParams}`,
      icon: HelpCircle,
    },
    {
      title: "Grading",
      url: `/dashboard/grading?${moduleParams}`,
      icon: ClipboardCheck,
    },
    {
      title: "Feedback Critiques",
      url: `/dashboard/feedback-critiques?${moduleParams}`,
      icon: MessageSquare,
    },
    {
      title: "Students",
      url: `/dashboard/students?${moduleParams}`,
      icon: Users,
    },
  ], [moduleParams]);

  const bottomNav = [
    {
      title: "Help",
      url: `/help`,
      icon: LifeBuoy,
    },
  ];


  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="p-4 pb-2 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center justify-center mb-3 group-data-[collapsible=icon]:mb-2">
          <div
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => router.push('/')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push('/'); }}
            aria-label="Go to homepage"
          >
            <div className="w-10 h-10 bg-emerald-700 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white font-bold text-lg">AP</span>
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight group-data-[collapsible=icon]:hidden">AI Pilot</span>
          </div>
        </div>

        {/* Module Selector - Hidden when collapsed */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800/70 transition-all duration-200 border border-gray-200 dark:border-gray-700 group-data-[collapsible=icon]:hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 bg-emerald-700 dark:bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Module</span>
                    <span className="text-sm font-bold text-foreground truncate capitalize">{module || 'Select module'}</span>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Switch Module</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {loadingModules ? (
              <DropdownMenuItem disabled>
                <span className="text-muted-foreground">Loading modules...</span>
              </DropdownMenuItem>
            ) : modules.length > 0 ? (
              modules.map((mod) => (
                <DropdownMenuItem
                  key={mod.id}
                  onClick={() => handleModuleSwitch(mod.name, mod.id)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className="w-6 h-6 bg-emerald-700 dark:bg-emerald-500 rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-semibold">{mod.name?.charAt(0)?.toUpperCase() || 'M'}</span>
                    </div>
                    <span className="capitalize truncate flex-1">{mod.name}</span>
                    {module === mod.name && (
                      <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>
                <span className="text-muted-foreground">No modules found</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push('/mymodules')}
              className="cursor-pointer text-emerald-600 dark:text-emerald-400 font-medium"
            >
              <span>View all modules</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Main Navigation */}
        <SidebarGroup className="mb-2">
          <SidebarGroupLabel className="px-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 group-data-[collapsible=icon]:hidden">
            MENU
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="h-9 px-2 rounded-lg transition-all duration-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 data-[active=true]:bg-emerald-700 data-[active=true]:text-white data-[active=true]:font-semibold data-[active=true]:shadow-sm"
                  >
                    <Link href={item.url} onClick={(e) => e.stopPropagation()}>
                      <item.icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Module Settings - Always Open */}
        <SidebarGroup className="mb-2">
          <SidebarGroupLabel className="px-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 group-data-[collapsible=icon]:hidden">
            MODULE SETTINGS
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.includes('/rubric')}
                  tooltip="AI Feedback Rubric"
                  className="h-9 px-2 rounded-lg transition-all duration-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 data-[active=true]:bg-emerald-700 data-[active=true]:text-white data-[active=true]:font-semibold data-[active=true]:shadow-sm"
                >
                  <Link href={`/dashboard/rubric?module=${module}`} onClick={(e) => e.stopPropagation()}>
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-medium">AI Feedback Rubric</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.includes('/chatbot-settings')}
                  tooltip="AI Chatbot Settings"
                  className="h-9 px-2 rounded-lg transition-all duration-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 data-[active=true]:bg-emerald-700 data-[active=true]:text-white data-[active=true]:font-semibold data-[active=true]:shadow-sm"
                >
                  <Link href={`/dashboard/chatbot-settings?module=${module}`} onClick={(e) => e.stopPropagation()}>
                    <Brain className="w-5 h-5" />
                    <span className="font-medium">AI Chatbot Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.includes('/survey')}
                  tooltip="Survey Settings"
                  className="h-9 px-2 rounded-lg transition-all duration-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 data-[active=true]:bg-emerald-700 data-[active=true]:text-white data-[active=true]:font-semibold data-[active=true]:shadow-sm"
                >
                  <Link href={`/dashboard/survey?module=${module}`} onClick={(e) => e.stopPropagation()}>
                    <FileText className="w-5 h-5" />
                    <span className="font-medium">Survey Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.includes('/consent')}
                  tooltip="Consent Form"
                  className="h-9 px-2 rounded-lg transition-all duration-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 data-[active=true]:bg-emerald-700 data-[active=true]:text-white data-[active=true]:font-semibold data-[active=true]:shadow-sm"
                  disabled={!currentModuleId}
                >
                  <Link href={currentModuleId ? `/module/${currentModuleId}/consent?module=${module}` : '#'} onClick={(e) => { if (!currentModuleId) e.preventDefault(); e.stopPropagation(); }}>
                    <Shield className="w-5 h-5" />
                    <span className="font-medium">Consent Form</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.includes('/dashboard/settings')}
                  tooltip="Settings"
                  className="h-11 px-3 rounded-lg transition-all duration-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 data-[active=true]:bg-emerald-700 data-[active=true]:text-white data-[active=true]:font-semibold data-[active=true]:shadow-sm"
                >
                  <Link href={`/dashboard/settings?module=${module}`} onClick={(e) => e.stopPropagation()}>
                    <Settings className="w-5 h-5" />
                    <span className="font-medium">Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Help Section */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {bottomNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="h-9 px-2 rounded-lg transition-all duration-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 data-[active=true]:bg-emerald-700 data-[active=true]:text-white data-[active=true]:font-semibold data-[active=true]:shadow-sm"
                  >
                    <Link href={item.url} onClick={(e) => e.stopPropagation()}>
                      <item.icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-gray-200 dark:border-gray-700">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 cursor-pointer transition-all duration-200 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2">
              <Avatar className="h-9 w-9 border-2 border-emerald-700">
                <AvatarImage src={user?.profile_image} alt={user?.username} />
                <AvatarFallback className="bg-emerald-700 text-white font-semibold text-sm">
                  {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-semibold text-foreground truncate">{user?.username || 'User'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.email || user?.role || 'Teacher'}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 group-data-[collapsible=icon]:hidden" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.username || 'User'}</p>
                <p className="text-xs text-muted-foreground">{user?.email || 'user@example.com'}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push('/profile')}
            >
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push('/settings')}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}