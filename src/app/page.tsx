import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/internal/command-centre");
  }

  redirect("/auth/sign-in?callbackUrl=%2Finternal%2Fcommand-centre");
}
