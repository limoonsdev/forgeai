"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CableIcon, CreditCardIcon, GiftIcon, LogOutIcon, MoonIcon, PaletteIcon, PuzzleIcon, SettingsIcon, SunIcon, UserIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useTheme } from "@/components/theme-provider";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ user }: { user: { name: string; email: string; image?: string | null; plan: string } }) {
  const router = useRouter();
  const { resolved, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full ring-offset-2 ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="user-menu">
          <Avatar src={user.image} name={user.name} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium text-foreground">{user.name}</div>
          <div className="truncate text-xs">{user.email}</div>
          <div className="mt-1.5 inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase">{user.plan}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/preferences">
            <SettingsIcon /> Agent preferences
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/billing">
            <CreditCardIcon /> Plan & credits
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/referrals">
            <GiftIcon /> Invite a friend, get $5
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/skills">
            <PuzzleIcon /> Skills
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/connectors">
            <CableIcon /> Connectors
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/appearance">
            <PaletteIcon /> Appearance
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/account">
            <UserIcon /> Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setTheme(resolved === "dark" ? "light" : "dark")}>
          {resolved === "dark" ? <SunIcon /> : <MoonIcon />} {resolved === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={async () => {
            await authClient.signOut();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOutIcon /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
