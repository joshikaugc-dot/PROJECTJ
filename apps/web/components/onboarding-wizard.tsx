"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardContent, Input, Kbd, Label, Textarea, cn } from "@contextos/ui";
import { api } from "@/lib/client";

export interface WizardVertical {
  id: string;
  name: string;
  description: string;
  status: "available" | "coming-soon";
  suggestedRoles: string[];
}

const STEPS = ["Account", "Organization", "Role", "Verticals", "Setup", "Extension"];
const ROLES = ["Founder", "CMO", "Head of Marketing", "Marketing Manager", "Growth Marketer", "Content Marketer"];

const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);
const commas = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

const NORTHSTAR = {
  org: {
    name: "Northstar",
    website: "https://northstar.example",
    industry: "Consumer wellness technology",
    description: "Wearable technology for recovery, stress and sleep insights.",
  },
  products: "Northstar Band — A screenless wearable for recovery, stress and sleep insights.",
  audience: "Young professionals\nFitness-focused consumers\nBusy executives",
  voice: "Confident, Minimal, Evidence-oriented, Optimistic, Never overly salesy",
  voiceDescription: "Calm, knowledgeable coach. Short sentences, plain words, specific claims.",
  competitors: "WHOOP, Oura, Garmin",
  goals: "Increase product awareness\nDrive customer acquisition",
};

export function OnboardingWizard({
  userName,
  email,
  verticals,
  hasOrganization,
}: {
  userName: string;
  email: string;
  verticals: WizardVertical[];
  hasOrganization: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [org, setOrg] = useState({ name: "", website: "", industry: "", description: "" });
  const [role, setRole] = useState("");
  const [selected, setSelected] = useState<string[]>(["marketing"]);
  const [setup, setSetup] = useState({ products: "", audience: "", voice: "", voiceDescription: "", competitors: "", goals: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fillDemo() {
    setOrg(NORTHSTAR.org);
    setRole("Head of Marketing");
    setSetup({
      products: NORTHSTAR.products,
      audience: NORTHSTAR.audience,
      voice: NORTHSTAR.voice,
      voiceDescription: NORTHSTAR.voiceDescription,
      competitors: NORTHSTAR.competitors,
      goals: NORTHSTAR.goals,
    });
  }

  const canContinue =
    (step === 2 && org.name.trim().length > 0) ||
    (step === 3 && role.trim().length > 0) ||
    (step === 4 && selected.length > 0) ||
    step === 1 ||
    step === 5;

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await api("/api/onboarding", "POST", {
        organization: org,
        role: { jobTitle: role },
        verticals: selected,
        setup: {
          products: lines(setup.products).map((line, i) => {
            const [name, ...rest] = line.split(/\s+[—–-]\s+/);
            return { name: name!.trim(), description: rest.join(" — ") || null, features: [], isPrimary: i === 0 };
          }),
          customers: lines(setup.audience).map((name, i) => ({ name, painPoints: [], isPrimary: i === 0 })),
          brand: {
            voiceAttributes: commas(setup.voice),
            voiceDescription: setup.voiceDescription || null,
            doList: [],
            dontList: [],
          },
          competitors: commas(setup.competitors).map((name) => ({ name })),
          goals: lines(setup.goals).map((title) => ({ title, verticalId: "marketing" })),
        },
      });
      setStep(6);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <ol className="mb-6 flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col gap-1.5">
            <div className={cn("h-1 rounded-full", i + 1 <= step ? "bg-primary" : "bg-muted")} />
            <span className={cn("text-[11px]", i + 1 === step ? "font-medium text-foreground" : "text-muted-foreground")}>{label}</span>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="flex flex-col gap-5 p-6">
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold">Welcome, {userName.split(" ")[0]}</h2>
              <p className="text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{email}</span>. In a few steps ContextOS will know your company, your role and how you work — so you never have to explain it to an AI again.
              </p>
              {hasOrganization && <Badge variant="secondary" className="self-start">You already belong to an organization — this updates it.</Badge>}
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Your organization</h2>
                  <p className="text-muted-foreground">The basics every answer is anchored to.</p>
                </div>
                <Button size="sm" variant="ghost" onClick={fillDemo}><Sparkles /> Use Northstar demo</Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5"><Label htmlFor="org-name">Name</Label><Input id="org-name" value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="org-web">Website</Label><Input id="org-web" value={org.website} onChange={(e) => setOrg({ ...org, website: e.target.value })} placeholder="https://" /></div>
                <div className="flex flex-col gap-1.5 md:col-span-2"><Label htmlFor="org-ind">Industry</Label><Input id="org-ind" value={org.industry} onChange={(e) => setOrg({ ...org, industry: e.target.value })} /></div>
                <div className="flex flex-col gap-1.5 md:col-span-2"><Label htmlFor="org-desc">Description</Label><Textarea id="org-desc" rows={3} value={org.description} onChange={(e) => setOrg({ ...org, description: e.target.value })} placeholder="What does the company do, for whom?" /></div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h2 className="text-lg font-semibold">Your role</h2>
                <p className="text-muted-foreground">ContextOS adapts depth and framing to how you work.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <button key={r} onClick={() => setRole(r)} className={cn("rounded-full border px-3 py-1.5 text-[13px]", role === r ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted")}>
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="role">Or type your role</Label><Input id="role" value={role} onChange={(e) => setRole(e.target.value)} /></div>
            </>
          )}

          {step === 4 && (
            <>
              <div>
                <h2 className="text-lg font-semibold">Choose your verticals</h2>
                <p className="text-muted-foreground">Each vertical adds specialized skills to the same shortcut. More are on the way.</p>
              </div>
              <div className="flex flex-col gap-2">
                {verticals.map((v) => {
                  const available = v.status === "available";
                  const on = selected.includes(v.id);
                  return (
                    <button
                      key={v.id}
                      disabled={!available}
                      onClick={() => setSelected((s) => (on ? s.filter((x) => x !== v.id) : [...s, v.id]))}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                        on ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                      )}
                    >
                      <div>
                        <div className="font-medium">{v.name}</div>
                        <div className="text-xs text-muted-foreground">{v.description}</div>
                      </div>
                      {available ? (
                        <span className={cn("flex size-5 items-center justify-center rounded-full border", on ? "border-primary bg-primary text-white" : "border-border")}>
                          {on && <Check className="size-3" />}
                        </span>
                      ) : (
                        <Badge variant="secondary">Coming soon</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <div>
                <h2 className="text-lg font-semibold">Marketing setup</h2>
                <p className="text-muted-foreground">A quick start — you can add detail later in Company Brain.</p>
              </div>
              <div className="grid gap-4">
                <div className="flex flex-col gap-1.5"><Label htmlFor="s-prod">Products <span className="font-normal text-muted-foreground">· one per line, “Name — description”</span></Label><Textarea id="s-prod" rows={2} value={setup.products} onChange={(e) => setSetup({ ...setup, products: e.target.value })} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="s-aud">Audience <span className="font-normal text-muted-foreground">· one segment per line</span></Label><Textarea id="s-aud" rows={3} value={setup.audience} onChange={(e) => setSetup({ ...setup, audience: e.target.value })} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="s-voice">Brand voice <span className="font-normal text-muted-foreground">· comma separated</span></Label><Input id="s-voice" value={setup.voice} onChange={(e) => setSetup({ ...setup, voice: e.target.value })} placeholder="Confident, Minimal, Optimistic" /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="s-voice-d">How you sound</Label><Input id="s-voice-d" value={setup.voiceDescription} onChange={(e) => setSetup({ ...setup, voiceDescription: e.target.value })} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="s-comp">Competitors <span className="font-normal text-muted-foreground">· comma separated</span></Label><Input id="s-comp" value={setup.competitors} onChange={(e) => setSetup({ ...setup, competitors: e.target.value })} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="s-goals">Marketing goals <span className="font-normal text-muted-foreground">· one per line</span></Label><Textarea id="s-goals" rows={2} value={setup.goals} onChange={(e) => setSetup({ ...setup, goals: e.target.value })} /></div>
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <div>
                <h2 className="text-lg font-semibold">Install the Chrome extension</h2>
                <p className="text-muted-foreground">ContextOS lives in the apps you already use.</p>
              </div>
              <ol className="flex flex-col gap-3 text-[13px]">
                <li><b>1.</b> Build it: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">pnpm --filter @contextos/extension build</code></li>
                <li><b>2.</b> Open <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">chrome://extensions</code>, enable Developer mode, click <i>Load unpacked</i> and choose <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">apps/extension/dist</code>.</li>
                <li><b>3.</b> Click the ContextOS toolbar icon → <b>Connect</b>.</li>
                <li><b>4.</b> In Gmail, select your draft and press <Kbd>⌘</Kbd> <Kbd>⇧</Kbd> <Kbd>K</Kbd> (<Kbd>Ctrl</Kbd> <Kbd>⇧</Kbd> <Kbd>K</Kbd> on Windows).</li>
              </ol>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            {step > 1 && step < 6 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft /> Back</Button>
            ) : <span />}
            {step < 5 && (
              <Button onClick={() => setStep(step + 1)} disabled={!canContinue}>Continue <ArrowRight /></Button>
            )}
            {step === 5 && (
              <Button onClick={submit} disabled={pending}>{pending && <Loader2 className="animate-spin" />} Finish setup <ArrowRight /></Button>
            )}
            {step === 6 && (
              <Button onClick={() => { router.push("/home"); router.refresh(); }}>Go to dashboard <ArrowRight /></Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
