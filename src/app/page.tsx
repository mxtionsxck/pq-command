import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/internal");
  }

  redirect("/auth/sign-in?callbackUrl=%2Finternal");
}
