import PrivacyPageClient from "./PrivacyPageClient";

export const metadata = {
  title: "Privacy Policy",
  description: "Read the Ai Education Pilot privacy policy and how we handle student and teacher data.",
  alternates: { canonical: "/privacy" },
};

export default function Page() {
  return <PrivacyPageClient />;
}
