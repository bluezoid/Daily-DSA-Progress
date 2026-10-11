import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/common/page-header";
import { FormSkeleton } from "@/components/common/skeletons";
import { DeleteAccount, PasswordForm, ProfileForm } from "@/components/settings/settings-forms";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Settings" };

async function Settings() {
  const user = await requireUser();
  return (
    <div className="grid gap-6">
      <ProfileForm name={user.name} email={user.email} timezone={user.timezone} />
      <PasswordForm />
      <section className="rounded-xl border bg-card p-4 text-sm text-muted-foreground sm:p-5">
        <h2 className="font-medium text-foreground">Password reset</h2>
        <p className="mt-1">Email-based password reset is not part of this version. Keep your password somewhere safe.</p>
      </section>
      <DeleteAccount />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Account, timezone and security." />
      <Suspense fallback={<FormSkeleton />}>
        <Settings />
      </Suspense>
    </div>
  );
}
