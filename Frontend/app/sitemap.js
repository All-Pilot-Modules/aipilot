import { SITE_URL } from "@/lib/siteConfig";

export default function sitemap() {
  const now = new Date();

  const routes = [
    { url: "", priority: 1.0, changeFrequency: "weekly" },
    { url: "/about", priority: 0.8, changeFrequency: "monthly" },
    { url: "/help", priority: 0.7, changeFrequency: "monthly" },
    { url: "/user-manual", priority: 0.7, changeFrequency: "monthly" },
    { url: "/contact", priority: 0.6, changeFrequency: "monthly" },
    { url: "/join", priority: 0.6, changeFrequency: "monthly" },
    { url: "/sign-in", priority: 0.5, changeFrequency: "yearly" },
    { url: "/sign-up", priority: 0.5, changeFrequency: "yearly" },
    { url: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { url: "/terms", priority: 0.3, changeFrequency: "yearly" },
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route.url}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
