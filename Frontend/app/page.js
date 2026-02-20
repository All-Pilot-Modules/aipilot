"use client";

import { useAuth } from "@/context/AuthContext";
import dynamic from "next/dynamic";

const DashboardPage = dynamic(() => import("@/components/dashboard/DashboardPage"));
const LandingPage = dynamic(() => import("@/components/landing/LandingPage"));

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return isAuthenticated ? <DashboardPage user={user} /> : <LandingPage />;
}
