import UserManualClient from "./UserManualClient";

export const metadata = {
  title: "User Manual",
  description:
    "Step-by-step guide to building courses, grading with AI, and using every feature of Ai Education Pilot.",
  alternates: { canonical: "/user-manual" },
};

export default function Page() {
  return <UserManualClient />;
}
