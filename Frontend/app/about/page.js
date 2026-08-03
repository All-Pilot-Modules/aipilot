import AboutPageClient from "./AboutPageClient";

export const metadata = {
  title: "About Us",
  description:
    "Learn about Ai Education Pilot — an open-source, AI-powered platform helping teachers build courses and assessments and give students instant, personalized feedback.",
  alternates: { canonical: "/about" },
};

export default function Page() {
  return <AboutPageClient />;
}
