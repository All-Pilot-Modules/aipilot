import JoinModuleClient from "./JoinModuleClient";

export const metadata = {
  title: "Join a Module",
  description:
    "Enter your access code to join a class module on Ai Education Pilot and start your assignments.",
  alternates: { canonical: "/join" },
};

export default function Page() {
  return <JoinModuleClient />;
}
