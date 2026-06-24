"use client";

import dynamic from "next/dynamic";

const LandingPage = dynamic(() => import("@/components/landing/LandingPage"));

export default function Home() {
  return <LandingPage />;
}
