"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { togglePausedAction } from "@/server/actions";
import { Button } from "../ui";
import { PauseIcon, PlayIcon } from "../ui/icons";

/**
 * Pause / resume online ordering (docs/PRD.md §16).
 *
 * This is the control a manager reaches for when the kitchen is drowning, so
 * it is one tap, it shows its pending state, and — because it is destructive
 * to revenue in one direction — pausing asks for confirmation while resuming
 * does not.
 */
export function PauseOrderingButton({
  paused,
  pauseLabel,
  resumeLabel,
}: {
  paused: boolean;
  pauseLabel: string;
  resumeLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    if (!paused && !window.confirm(pauseLabel)) return;
    startTransition(async () => {
      await togglePausedAction(!paused);
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={paused ? "success" : "secondary"}
      onClick={toggle}
      disabled={pending}
    >
      {paused ? <PlayIcon /> : <PauseIcon />}
      {paused ? resumeLabel : pauseLabel}
    </Button>
  );
}
