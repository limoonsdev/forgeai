"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LoaderCircleIcon, SaveIcon } from "lucide-react";
import type { PublicModel } from "@/lib/ai/catalog";
import { ModelPicker } from "@/components/shared/model-picker";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Row, SettingsSection } from "./settings-nav";

export type PrefsValue = {
  defaultModel: string;
  tokenSaver: boolean;
  aiLanguage: string;
  stylePreset: string;
  customInstructions: string;
  autoFixErrors: boolean;
  askClarifyingQuestions: boolean;
  emailNotifications: boolean;
};

const LANGS = [
  ["auto", "Match my language"],
  ["en", "English"],
  ["fr", "Français"],
  ["es", "Español"],
  ["de", "Deutsch"],
  ["it", "Italiano"],
  ["pt", "Português"],
  ["nl", "Nederlands"],
  ["ja", "日本語"],
  ["zh", "中文"],
];

const STYLES = [
  ["modern", "Modern & clean"],
  ["minimal", "Minimal"],
  ["playful", "Playful"],
  ["corporate", "Corporate"],
  ["brutalist", "Brutalist"],
  ["luxury", "Luxury"],
];

export function PreferencesForm({ initial, models }: { initial: PrefsValue; models: PublicModel[] }) {
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof PrefsValue>(k: K, val: PrefsValue[K]) => setV((s) => ({ ...s, [k]: val }));
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/settings/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
    setSaving(false);
    if (res.ok) {
      setSaved(v);
      toast.success("Preferences saved");
    }
    else toast.error((await res.json().catch(() => null))?.error?.message ?? "Could not save");
  };

  return (
    <div className="space-y-6">
      <SettingsSection title="AI agent" description="How Forged builds for you by default. You can override the model and token saver per project.">
        <div className="divide-y">
          <Row label="Default model" hint="Used for new projects.">
            <ModelPicker models={models} value={v.defaultModel} onChange={(id) => set("defaultModel", id)} side="bottom" />
          </Row>
          <Row label="Token saver by default" hint="Lower reasoning effort, trimmed context and shorter replies. Usually about half the cost.">
            <Switch checked={v.tokenSaver} onCheckedChange={(c) => set("tokenSaver", c)} data-testid="pref-token-saver" />
          </Row>
          <Row label="Reply language" hint="The language the agent answers in.">
            <Select value={v.aiLanguage} onValueChange={(x) => set("aiLanguage", x)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGS.map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Design style" hint="The visual direction the agent leans towards when you don't specify one.">
            <Select value={v.stylePreset} onValueChange={(x) => set("stylePreset", x)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Ask clarifying questions" hint="Let the agent send you quick polls when an important decision is ambiguous.">
            <Switch checked={v.askClarifyingQuestions} onCheckedChange={(c) => set("askClarifyingQuestions", c)} />
          </Row>
          <Row label="Auto-fix errors" hint="Fix compile and runtime errors found in the preview automatically.">
            <Switch checked={v.autoFixErrors} onCheckedChange={(c) => set("autoFixErrors", c)} />
          </Row>
        </div>
      </SettingsSection>

      <SettingsSection title="Custom instructions" description="Always-on guidance for the agent: your brand, conventions, favourite libraries…">
        <Textarea
          value={v.customInstructions}
          onChange={(e) => set("customInstructions", e.target.value)}
          maxLength={4000}
          rows={6}
          placeholder={"e.g. Use a warm, friendly tone in copy. Prefer shadcn-style components. Our brand color is #FF6A1A."}
        />
        <p className="mt-2 text-right text-xs text-muted-foreground">{v.customInstructions.length}/4000</p>
      </SettingsSection>

      <SettingsSection title="Email">
        <div className="divide-y">
          <Row label="Email notifications" hint="Product updates and important account emails.">
            <Switch checked={v.emailNotifications} onCheckedChange={(c) => set("emailNotifications", c)} />
          </Row>
        </div>
      </SettingsSection>

      <div className="sticky bottom-4 flex justify-end">
        <Button variant="ember" size="lg" onClick={save} disabled={!dirty || saving} data-testid="save-preferences">
          {saving ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />} Save preferences
        </Button>
      </div>
    </div>
  );
}
