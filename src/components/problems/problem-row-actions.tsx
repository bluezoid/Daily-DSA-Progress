"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { ExternalLink, MoreHorizontal, Pencil, Plus, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDelete } from "@/components/common/confirm-delete";

export function ProblemRowActions({ id, title, sourceUrl }: { id: string; title: string; sourceUrl: string | null }) {
  const [confirm, setConfirm] = useState(false);
  useLayoutEffect(() => () => setConfirm(false), []);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${title}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/problems/${id}`}>
              <Eye aria-hidden /> Open
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/problems/${id}/edit`}>
              <Pencil aria-hidden /> Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/problems/${id}/solutions/new`}>
              <Plus aria-hidden /> Add solution
            </Link>
          </DropdownMenuItem>
          {sourceUrl && (
            <DropdownMenuItem asChild>
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
                <ExternalLink aria-hidden /> Open source
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
            <Trash2 aria-hidden /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDelete
        open={confirm}
        onOpenChange={setConfirm}
        endpoint={`/api/problems/${id}`}
        title={`Delete “${title}”?`}
        description="This permanently deletes the problem, all of its solution versions and their revision history."
        successMessage="Problem deleted"
      />
    </>
  );
}
