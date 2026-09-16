import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { InspectionApp } from "@/components/inspection";
import { LogoutButton } from "@/components/misc/LogoutButton";
import { Layout } from "@/components/layout/Layout";
import LandingPage from "@/components/layout/Landing";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return <>
    <LandingPage/>
  </>;
}