"use client";

import * as React from "react";
import { Avatar as AvatarPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function Avatar({ className, src, name, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root> & { src?: string | null; name?: string | null }) {
  const initials = (name || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <AvatarPrimitive.Root className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full", className)} {...props}>
      {src ? <AvatarPrimitive.Image className="aspect-square size-full object-cover" src={src} alt={name ?? ""} /> : null}
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center bg-ember text-xs font-semibold text-white">
        {initials}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export { Avatar };
