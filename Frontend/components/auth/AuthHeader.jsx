'use client';

import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/mode-toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
export default function AuthHeader() {
  const { user, logout, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <header className="flex justify-end items-center p-4 gap-4 h-16 dark:bg-black">
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
        <ModeToggle />
      </header>
    );
  }

  return (
    <header className="flex justify-between items-center px-3 sm:px-4 py-3 gap-2 sm:gap-4 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 font-bold text-lg sm:text-xl text-gray-900 dark:text-white">
        <div className="w-8 h-8 bg-emerald-700 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-bold">AP</span>
        </div>
        <span className="hidden sm:inline">AI Pilot</span>
      </Link>

      <div className="flex items-center gap-2 sm:gap-4">
        {!isAuthenticated ? (
          <>
            <Button variant="ghost" asChild size="sm" className="text-xs sm:text-sm px-2 sm:px-4">
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild size="sm" className="text-xs sm:text-sm px-3 sm:px-4">
              <Link href="/sign-up">Sign Up</Link>
            </Button>
          </>
        ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profile_image} alt={user?.username} />
                <AvatarFallback>
                  {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.username}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
                <p className="text-xs leading-none text-muted-foreground capitalize">
                  {user?.role}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/mymodules" className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                <span>My Modules</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={logout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
        <ModeToggle />
      </div>
    </header>
  );
}