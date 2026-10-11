"use client";

import { useLayoutEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/common/confirm-delete";

export function DeleteProblemButton({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => () => setOpen(false), []);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="text-destructive hover:text-destructive">
        <Trash2 aria-hidden /> Delete
      </Button>
      <ConfirmDelete
        open={open}
        onOpenChange={setOpen}
        endpoint={`/api/problems/${id}`}
        title={`Delete “${title}”?`}
        description="This permanently deletes the problem, all of its solution versions and their revision history."
        redirectTo="/problems"
        successMessage="Problem deleted"
      />
    </>
  );
}
