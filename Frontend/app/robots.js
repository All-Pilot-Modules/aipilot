import { SITE_URL } from "@/lib/siteConfig";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/mymodules",
        "/profile",
        "/settings",
        "/student",
        "/student-dashboard",
        "/module",
        "/verify-email",
        "/forgot-password",
        "/reset-password",
        "/unauthorized",
        "/temp",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
