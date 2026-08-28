import type { ReactNode } from "react";

import { requireCurrentUser } from "@/server/auth/session";

type InternalLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function InternalLayout({
  children,
}: InternalLayoutProps) {
  await requireCurrentUser();

  return children;
}
