"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { LoaderCircleIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsSection } from "./settings-nav";

export function AccountView({ user, hasPassword }: { user: { name: string; email: string; image: string | null; createdAt: string }; hasPassword: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");

  return (
    <div className="space-y-6">
      <SettingsSection title="Profile">
        <div className="flex items-center gap-4">
          <Avatar src={user.image} name={user.name} className="size-14 text-base" />
          <div>
            <p className="font-medium">{user.email}</p>
            <p className="text-xs text-muted-foreground">Member since {new Date(user.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <form
          className="mt-6 flex max-w-md items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy("name");
            const { error } = await authClient.updateUser({ name });
            setBusy(null);
            if (error) toast.error(error.message ?? "Could not update");
            else {
              toast.success("Profile updated");
              router.refresh();
            }
          }}
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <Button type="submit" variant="outline" disabled={busy === "name" || name === user.name || !name.trim()}>
            {busy === "name" && <LoaderCircleIcon className="animate-spin" />} Save
          </Button>
        </form>
      </SettingsSection>

      {hasPassword && (
        <SettingsSection title="Password">
          <form
            className="grid max-w-md gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy("password");
              const { error } = await authClient.changePassword({
                currentPassword: String(f.get("current")),
                newPassword: String(f.get("next")),
                revokeOtherSessions: true,
              });
              setBusy(null);
              if (error) toast.error(error.message ?? "Could not change the password");
              else {
                toast.success("Password changed");
                (e.target as HTMLFormElement).reset();
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="current">Current password</Label>
              <Input id="current" name="current" type="password" required autoComplete="current-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next">New password</Label>
              <Input id="next" name="next" type="password" required minLength={8} autoComplete="new-password" />
            </div>
            <Button type="submit" variant="outline" className="w-fit" disabled={busy === "password"}>
              {busy === "password" && <LoaderCircleIcon className="animate-spin" />} Change password
            </Button>
          </form>
        </SettingsSection>
      )}

      <SettingsSection title="Danger zone" description="Deleting your account removes all projects, VMs, skills, API keys and remaining credits. This cannot be undone.">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive">Delete my account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                Type <strong>DELETE</strong> to confirm.
              </DialogDescription>
            </DialogHeader>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={confirm !== "DELETE" || busy === "delete"}
                onClick={async () => {
                  setBusy("delete");
                  const { error } = await authClient.deleteUser({ callbackURL: "/" });
                  setBusy(null);
                  if (error) return toast.error(error.message ?? "Could not delete the account");
                  toast.success("Your account was deleted");
                  router.push("/");
                  router.refresh();
                }}
              >
                {busy === "delete" && <LoaderCircleIcon className="animate-spin" />} Delete forever
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SettingsSection>
    </div>
  );
}
