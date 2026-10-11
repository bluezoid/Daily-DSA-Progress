"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { api, ApiClientError } from "@/lib/api-client";

/** Only same-site relative paths are allowed as post-login destinations. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
}

export function AuthForm({ mode, next }: { mode: "login" | "register"; next: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: Record<string, string> = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    if (mode === "register") {
      body.name = String(form.get("name") ?? "");
      body.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    setPending(true);
    setError(null);
    setFields({});
    try {
      await api(`/api/auth/${mode}`, { method: "POST", body });
      router.replace(safeNext(next));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        setFields(err.fields);
      } else setError("Network error. Try again.");
      setPending(false);
    }
  }

  const fe = (k: string) => fields[k]?.[0];

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div>
        <h1 className="text-xl font-semibold">{mode === "login" ? "Sign in" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login" ? "Welcome back. Pick up where you left off." : "Your problems and solutions stay private to you."}
        </p>
      </div>
      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {mode === "register" && (
        <Field id="name" label="Name" error={fe("name")}>
          <Input id="name" name="name" autoComplete="name" required maxLength={80} aria-invalid={!!fe("name")} />
        </Field>
      )}
      <Field id="email" label="Email" error={fe("email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!fe("email")} />
      </Field>
      <Field id="password" label="Password" error={fe("password")} hint={mode === "register" ? "At least 8 characters." : undefined}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "register" ? 8 : undefined}
          aria-invalid={!!fe("password")}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link className="text-primary underline-offset-4 hover:underline" href="/register">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link className="text-primary underline-offset-4 hover:underline" href="/login">
              Sign in
            </Link>
          </>
        )}
      </p>
      {mode === "login" && (
        <p className="text-center text-xs text-muted-foreground">
          Password reset by email is not available yet. If you are signed in elsewhere, you can change your password in Settings.
        </p>
      )}
    </form>
  );
}
