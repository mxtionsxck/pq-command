import { redirect } from "next/navigation";

export default function InternalLeadsRedirectPage() {
  redirect("/internal/company-lets/qualified-leads?view=qualified");
}
