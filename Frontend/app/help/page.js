import HelpPageClient from "./HelpPageClient";

export const metadata = {
  title: "Help Center",
  description:
    "Find answers to common questions about using Ai Education Pilot, for both students and teachers.",
  alternates: { canonical: "/help" },
};

export default function Page() {
  return <HelpPageClient />;
}
