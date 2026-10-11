"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <h2 className="font-medium">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ProfileForm({ name, email, timezone }: { name: string; email: string; timezone: string }) {
  const router = useRouter();
  const [values, setValues] = useState({ name, timezone });
  const [pending, setPending] = useState(false);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const zones = useMemo(() => {
    try {
      const list = Intl.supportedValuesOf("timeZone");
      return list.includes(timezone) ? list : [timezone, ...list];
    } catch {
      return [timezone, "UTC"];
    }
  }, [timezone]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setFields({});
    try {
      await api("/api/auth/me", { method: "PATCH", body: values });
      toast.success("Profile saved");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) setFields(err.fields);
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card title="Profile" description={`Signed in as ${email}`}>
      <form onSubmit={save} className="grid gap-4 sm:max-w-md">
        <Field id="name" label="Name" error={fields.name?.[0]}>
          <Input id="name" value={values.name} maxLength={80} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />
        </Field>
        <Field id="timezone" label="Timezone" error={fields.timezone?.[0]} hint="Decides when “today” starts for due revisions.">
          <Select value={values.timezone} onValueChange={(tz) => setValues((v) => ({ ...v, timezone: tz }))}>
            <SelectTrigger id="timezone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {zones.map((z) => (
                <SelectItem key={z} value={z}>
                  {z}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Save profile
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setValues((v) => ({ ...v, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }))}
          >
            Use this device&apos;s timezone
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [pending, setPending] = useState(false);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setFields({});
    try {
      await api("/api/auth/password", {
        method: "POST",
        body: { currentPassword: String(data.get("currentPassword")), newPassword: String(data.get("newPassword")) },
      });
      form.reset();
      toast.success("Password changed. Other sessions were signed out.");
    } catch (err) {
      if (err instanceof ApiClientError) setFields(err.fields);
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card title="Password" description="Changing your password signs out every other session.">
      <form onSubmit={save} className="grid gap-4 sm:max-w-md">
        <Field id="currentPassword" label="Current password" error={fields.currentPassword?.[0]}>
          <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
        </Field>
        <Field id="newPassword" label="New password" error={fields.newPassword?.[0]} hint="At least 8 characters.">
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Button type="submit" disabled={pending} className="w-fit">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Change password
        </Button>
      </form>
    </Card>
  );
}

export function DeleteAccount() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await api("/api/auth/account", { method: "DELETE", body: { password } });
      toast.success("Account deleted");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? (err.fields.password?.[0] ?? err.message) : errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Card title="Delete account" description="Permanently deletes your account, problems, solutions and revision history.">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="text-destructive hover:text-destructive">Delete my account</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Enter your password to confirm.</AlertDialogDescription>
          </AlertDialogHeader>
          <Field id="deletePassword" label="Password" error={error ?? undefined}>
            <Input id="deletePassword" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button onClick={confirm} disabled={pending || !password} className="bg-destructive text-white hover:bg-destructive/90">
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Delete everything
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
