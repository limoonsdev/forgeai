"use client";

import * as React from "react";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} position="bottom-right" richColors closeButton />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion={reduced ? "always" : "user"}>
        <TooltipProvider>
          {children}
          <ThemedToaster />
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
