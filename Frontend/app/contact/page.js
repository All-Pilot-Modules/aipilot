import ContactPageClient from "./ContactPageClient";

export const metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the Ai Education Pilot team for support, questions, or feedback about the platform.",
  alternates: { canonical: "/contact" },
};

export default function Page() {
  return <ContactPageClient />;
}
