"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MenuIcon, XIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/#how", label: "How it works" },
  { href: "/#capabilities", label: "Capabilities" },
  { href: "/#models", label: "Models" },
  { href: "/pricing", label: "Pricing" },
];

export function Navbar({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3">
      <nav
        aria-label="Main"
        className={cn(
          "flex w-full max-w-6xl items-center justify-between rounded-2xl border px-3 py-2 transition-[background-color,border-color,box-shadow] duration-300 sm:px-4",
          scrolled ? "glass border-border shadow-[0_8px_40px_-12px_rgb(0_0_0/0.5)]" : "border-transparent bg-transparent",
        )}
      >
        <Link href="/" className="flex items-center" aria-label="Forged.dev home">
          <Logo />
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <Button asChild variant="ember" size="sm" className="h-9 px-4">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="h-9">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild variant="ember" size="sm" className="h-9 px-4">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>
        <button className="rounded-lg p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
        </button>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass absolute inset-x-3 top-[4.25rem] rounded-2xl border p-3 md:hidden"
          >
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm hover:bg-accent">
                {l.label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button asChild variant="outline">
                <Link href={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Dashboard" : "Log in"}</Link>
              </Button>
              <Button asChild variant="ember">
                <Link href="/signup">Sign up</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
