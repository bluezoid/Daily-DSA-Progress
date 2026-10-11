"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, errorMessage } from "@/lib/api-client";

export function ConfirmDelete({
  open,
  onOpenChange,
  endpoint,
  title,
  description,
  redirectTo,
  successMessage = "Deleted",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  endpoint: string;
  title: string;
  description: string;
  redirectTo?: string;
  successMessage?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function confirm(e: React.MouseEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await api(endpoint, { method: "DELETE" });
      toast.success(successMessage);
      onOpenChange(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={pending} className="bg-destructive text-white hover:bg-destructive/90">
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
