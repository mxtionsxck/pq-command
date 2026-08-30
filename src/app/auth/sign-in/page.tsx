import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { AuthError } from "next-auth";
import { AppShell } from "@/components/layout/app-shell";
import { PqLogo } from "@/components/layout/pq-logo";
import { Badge, Button } from "@/components/ui";
import { appEnv } from "@/lib/env";
import {
  isAnyAuthProviderConfigured,
  isAuthProviderConfigured,
  isLocalAdminAuthConfigured,
  sanitizeCallbackUrl,
} from "@/server/auth";

type SignInPageProps = Readonly<{
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
}>;

function resolveSignInErrorMessage(errorCode: string | undefined) {
  switch (errorCode) {
    case "CredentialsSignin":
      return "Incorrect username or password. Please try again.";
    default:
      return undefined;
  }
}

function resolveSafePostLoginRoute(callbackUrl: string | undefined) {
  const sanitized = sanitizeCallbackUrl(callbackUrl);

  if (
    sanitized === "/internal/command-centre" ||
    sanitized.startsWith("/internal/command-centre?")
  ) {
    return "/internal";
  }

  return sanitized;
}

async function signInAction(formData: FormData) {
  "use server";

  if (!isAuthProviderConfigured(appEnv)) {
    return;
  }

  const callbackUrl = sanitizeCallbackUrl(
    String(formData.get("callbackUrl") ?? "/internal"),
  );

  await signIn("microsoft-entra-id", {
    redirectTo: resolveSafePostLoginRoute(callbackUrl),
  });
}

async function localAdminSignInAction(formData: FormData) {
  "use server";

  if (!isLocalAdminAuthConfigured(appEnv)) {
    return;
  }

  const callbackUrl = sanitizeCallbackUrl(
    String(formData.get("callbackUrl") ?? "/internal"),
  );
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", {
      username,
      password,
      redirectTo: resolveSafePostLoginRoute(callbackUrl),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = error.type ?? "CredentialsSignin";
      redirect(`/auth/sign-in?error=${encodeURIComponent(code)}`);
    }

    throw error;
  }
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = resolveSafePostLoginRoute(params.callbackUrl);
  const signInErrorMessage = resolveSignInErrorMessage(params.error);
  const isEntraConfigured = isAuthProviderConfigured(appEnv);
  const isLocalAdminConfigured = isLocalAdminAuthConfigured(appEnv);
  const isConfigured = isAnyAuthProviderConfigured(appEnv);

  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-lg rounded-[var(--pq-radius-xl)] border border-[color:var(--pq-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] p-6 shadow-[var(--pq-shadow-panel)] sm:p-8">
        <div className="space-y-6">
          <PqLogo />

          <div className="space-y-2 border-b border-[color:rgba(215,192,140,0.12)] pb-5">
            <p className="pq-kicker">Secure Access</p>
            <h1 className="text-4xl font-semibold tracking-[-0.03em] text-white">
              Sign In
            </h1>
            <p className="pq-copy-muted text-sm leading-6 sm:text-base">
              Use your setup credentials to unlock all pages.
            </p>
          </div>

          {!isConfigured ? (
            <p className="rounded-[var(--pq-radius-sm)] border border-[color:rgba(183,92,92,0.35)] bg-[rgba(183,92,92,0.12)] px-4 py-3 text-sm text-[color:var(--pq-color-ivory-100)]">
              Sign-in is disabled until authentication configuration is present.
            </p>
          ) : null}

          {signInErrorMessage ? (
            <p className="rounded-[var(--pq-radius-sm)] border border-[color:rgba(183,92,92,0.35)] bg-[rgba(183,92,92,0.12)] px-4 py-3 text-sm text-[color:var(--pq-color-ivory-100)]">
              {signInErrorMessage}
            </p>
          ) : null}

          {isLocalAdminConfigured ? (
            <form action={localAdminSignInAction} className="space-y-3">
              <input name="callbackUrl" type="hidden" value={callbackUrl} />
              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-[0.2em] pq-copy-subtle">Username</span>
                <input
                  className="min-h-11 w-full rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/25 px-3 text-white"
                  defaultValue="PQADMIN"
                  name="username"
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-[0.2em] pq-copy-subtle">Password</span>
                <input
                  className="min-h-11 w-full rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/25 px-3 text-white"
                  name="password"
                  required
                  type="password"
                />
              </label>
              <Button className="w-full" type="submit">Continue</Button>
            </form>
          ) : null}

          {isEntraConfigured ? (
            <form action={signInAction}>
              <input name="callbackUrl" type="hidden" value={callbackUrl} />
              <Button className="w-full" type="submit" variant="secondary">
                Continue with Microsoft
              </Button>
            </form>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Badge tone={isLocalAdminConfigured ? "success" : "warning"}>
              Private admin {isLocalAdminConfigured ? "configured" : "not configured"}
            </Badge>
            <Badge tone={isEntraConfigured ? "success" : "warning"}>
              Microsoft {isEntraConfigured ? "configured" : "not configured"}
            </Badge>
          </div>

          <div className="pt-1 text-sm">
            <Link className="text-[color:var(--pq-accent-strong)]" href="/">
              Return to home
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
