"use client";

import { useState } from "react";
import { CheckCircle2Icon, LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const REASONS: [string, string][] = [
  ["phishing", "Phishing or impersonation"],
  ["malware", "Malware or hacking"],
  ["fraud", "Fraud or scam"],
  ["csam", "Child sexual abuse material"],
  ["illegal", "Other illegal goods or content"],
  ["hate", "Violence, hate or harassment"],
  ["privacy", "Personal data or privacy"],
  ["copyright", "Copyright or trademark"],
  ["other", "Something else"],
];

export function ReportForm({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [reason, setReason] = useState("phishing");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  if (state === "sent")
    return (
      <div className="mt-8 flex items-start gap-3 rounded-2xl border bg-card/60 p-5">
        <CheckCircle2Icon className="mt-0.5 size-5 text-success" />
        <div>
          <p className="font-medium">Thank you. Your report was received.</p>
          <p className="mt-1 text-sm text-muted-foreground">We review reports as quickly as we can and act on content that breaks the law or our policies.</p>
        </div>
      </div>
    );

  return (
    <form
      className="mt-8 space-y-5 rounded-2xl border bg-card/60 p-5 sm:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        setError("");
        const res = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, reason, details, email, website }) }).catch(() => null);
        if (res?.ok) setState("sent");
        else {
          const data = await res?.json().catch(() => null);
          setError(data?.error?.message ?? "Something went wrong. Please email us instead.");
          setState("error");
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="r-url">Address of the app or share link</Label>
        <Input id="r-url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://name-project.forged.dev" maxLength={500} />
      </div>
      <div className="space-y-2">
        <Label>Reason</Label>
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REASONS.map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="r-details">What is wrong with it?</Label>
        <Textarea id="r-details" value={details} onChange={(e) => setDetails(e.target.value)} rows={5} maxLength={4000} placeholder="Explain why you believe the content is illegal or breaks the policy." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="r-email">Your email {reason === "csam" ? "(optional)" : "(so we can follow up)"}</Label>
        <Input id="r-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
      </div>
      <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">By sending this report you confirm that the information is accurate and complete to the best of your knowledge.</p>
      <Button type="submit" variant="ember" disabled={state === "sending"}>
        {state === "sending" && <LoaderCircleIcon className="animate-spin" />} Send report
      </Button>
    </form>
  );
}
