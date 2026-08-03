import TermsPageClient from "./TermsPageClient";

export const metadata = {
  title: "Terms of Service",
  description: "Read the terms of service for using Ai Education Pilot.",
  alternates: { canonical: "/terms" },
};

export default function Page() {
  return <TermsPageClient />;
}
