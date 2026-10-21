"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CookieIcon, XIcon } from "lucide-react";

const KEY = "forged:cookie-notice";

/** Information only: Forged sets no tracking cookies, so there is nothing to consent to. */
export function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {}
  }, []);
  if (!show) return null;
  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  };
  return (
    <div role="region" aria-label="Cookies" className="fixed right-3 bottom-3 left-3 z-50 flex max-w-sm sm:right-auto items-start gap-3 rounded-xl border bg-popover/95 p-3.5 text-sm shadow-xl backdrop-blur sm:bottom-4 sm:left-4">
      <CookieIcon className="mt-0.5 size-4 shrink-0 text-primary" />
      <p className="text-muted-foreground">
        We only use cookies needed to sign you in and keep the service secure. No tracking.{" "}
        <Link href="/legal/cookies" className="text-foreground underline underline-offset-2">
          Details
        </Link>
      </p>
      <button onClick={close} className="-m-1 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close cookie notice">
        <XIcon className="size-4" />
      </button>
    </div>
  );
}
