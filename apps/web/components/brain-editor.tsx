"use client";

import { useId, useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import type { Brain, BrainSection } from "@contextos/shared";
import { Button, Card, CardContent, Input, Label, Textarea, cn } from "@contextos/ui";
import { api } from "@/lib/client";

type FieldType = "text" | "textarea" | "lines" | "tags" | "checkbox" | "select";
interface Field {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  wide?: boolean;
}

interface SectionConfig {
  id: BrainSection;
  label: string;
  description: string;
  list: boolean;
  itemLabel?: string;
  fields: Field[];
  empty?: Record<string, unknown>;
}

const SECTIONS: SectionConfig[] = [
  {
    id: "company",
    label: "Company",
    description: "The basics every answer is anchored to.",
    list: false,
    fields: [
      { key: "name", label: "Company name", type: "text" },
      { key: "industry", label: "Industry", type: "text" },
      { key: "website", label: "Website", type: "text", placeholder: "https://" },
      { key: "description", label: "What the company does", type: "textarea", wide: true },
    ],
  },
  {
    id: "products",
    label: "Products",
    description: "Products and services. The primary product is used when text doesn't name one.",
    list: true,
    itemLabel: "product",
    empty: { name: "", description: "", features: [], pricing: "", isPrimary: false },
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "pricing", label: "Pricing", type: "text" },
      { key: "description", label: "Description", type: "textarea", wide: true },
      { key: "features", label: "Key features", type: "lines", hint: "One per line", wide: true },
      { key: "isPrimary", label: "Primary product", type: "checkbox" },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    description: "Audience segments and personas.",
    list: true,
    itemLabel: "segment",
    empty: { name: "", description: "", painPoints: [], isPrimary: false },
    fields: [
      { key: "name", label: "Segment", type: "text" },
      { key: "description", label: "Who they are", type: "textarea", wide: true },
      { key: "painPoints", label: "Pain points", type: "lines", hint: "One per line", wide: true },
      { key: "isPrimary", label: "Primary segment", type: "checkbox" },
    ],
  },
  {
    id: "brand",
    label: "Brand",
    description: "Voice and positioning. Used by every writing skill.",
    list: false,
    fields: [
      { key: "voiceAttributes", label: "Voice attributes", type: "tags", hint: "Comma separated, e.g. Confident, Minimal", wide: true },
      { key: "voiceDescription", label: "How we sound", type: "textarea", wide: true },
      { key: "positioning", label: "Positioning", type: "textarea", wide: true },
      { key: "tagline", label: "Tagline", type: "text", wide: true },
      { key: "doList", label: "Do", type: "lines", hint: "One rule per line" },
      { key: "dontList", label: "Don't", type: "lines", hint: "One rule per line" },
    ],
  },
  {
    id: "competitors",
    label: "Competitors",
    description: "Included automatically when a competitor is mentioned.",
    list: true,
    itemLabel: "competitor",
    empty: { name: "", website: "", positioning: "", differentiators: "" },
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "website", label: "Website", type: "text" },
      { key: "positioning", label: "Their positioning", type: "textarea" },
      { key: "differentiators", label: "How we differ", type: "textarea" },
    ],
  },
  {
    id: "goals",
    label: "Goals",
    description: "Company-wide or vertical-specific goals.",
    list: true,
    itemLabel: "goal",
    empty: { title: "", description: "", metric: "", timeframe: "", verticalId: "marketing" },
    fields: [
      { key: "title", label: "Goal", type: "text" },
      { key: "verticalId", label: "Scope", type: "select", options: [{ value: "", label: "Company-wide" }, { value: "marketing", label: "Marketing" }] },
      { key: "description", label: "Description", type: "textarea", wide: true },
      { key: "metric", label: "Metric", type: "text" },
      { key: "timeframe", label: "Timeframe", type: "text" },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    description: "Campaigns, approved examples and guidelines. Only relevant documents are used per request.",
    list: true,
    itemLabel: "document",
    empty: { kind: "DOCUMENT", title: "", content: "", tags: [], verticalId: "" },
    fields: [
      { key: "title", label: "Title", type: "text" },
      {
        key: "kind",
        label: "Type",
        type: "select",
        options: [
          { value: "DOCUMENT", label: "Document" },
          { value: "CAMPAIGN", label: "Campaign" },
          { value: "CONTENT_EXAMPLE", label: "Content example" },
          { value: "GUIDELINE", label: "Guideline" },
          { value: "NOTE", label: "Note" },
        ],
      },
      { key: "content", label: "Content", type: "textarea", wide: true },
      { key: "tags", label: "Tags", type: "tags", hint: "Comma separated" },
      { key: "verticalId", label: "Scope", type: "select", options: [{ value: "", label: "All verticals" }, { value: "marketing", label: "Marketing" }] },
    ],
  },
];

type Item = Record<string, unknown>;

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange(v: unknown): void }) {
  const id = `f-${field.key}-${useId()}`;
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--primary)]" />
        {field.label}
      </label>
    );
  }
  const common = { id, placeholder: field.placeholder };
  return (
    <div className={cn("flex flex-col gap-1.5", field.wide && "md:col-span-2")}>
      <Label htmlFor={id}>
        {field.label} {field.hint && <span className="font-normal text-muted-foreground">· {field.hint}</span>}
      </Label>
      {field.type === "text" && <Input {...common} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />}
      {field.type === "textarea" && <Textarea {...common} rows={3} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />}
      {field.type === "lines" && (
        <Textarea
          {...common}
          rows={4}
          value={((value as string[]) ?? []).join("\n")}
          onChange={(e) => onChange(e.target.value.split("\n"))}
        />
      )}
      {field.type === "tags" && (
        <Input {...common} value={((value as string[]) ?? []).join(", ")} onChange={(e) => onChange(e.target.value.split(","))} />
      )}
      {field.type === "select" && (
        <select
          {...common}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </div>
  );
}

/** Trim list fields before saving (the textarea keeps blank lines while editing). */
function clean(fields: Field[], item: Item): Item {
  const out: Item = { ...item };
  for (const f of fields) {
    if (f.type === "lines" || f.type === "tags") {
      out[f.key] = ((item[f.key] as string[]) ?? []).map((s) => s.trim()).filter(Boolean);
    }
  }
  return out;
}

export function BrainEditor({ initial }: { initial: Brain }) {
  const [brain, setBrain] = useState<Brain>(initial);
  const [active, setActive] = useState<BrainSection>("company");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<BrainSection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<BrainSection>>(new Set());
  const section = SECTIONS.find((s) => s.id === active)!;

  function update(next: unknown) {
    setBrain((b) => ({ ...b, [active]: next }));
    setDirty((d) => new Set(d).add(active));
    setSaved(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const value = brain[active];
      const payload = section.list
        ? (value as Item[]).map((item) => clean(section.fields, item))
        : clean(section.fields, value as Item);
      const result = await api<Record<string, unknown>>(`/api/brain/${active}`, "PUT", payload);
      setBrain((b) => ({ ...b, [active]: result[active] }));
      setDirty((d) => {
        const next = new Set(d);
        next.delete(active);
        return next;
      });
      setSaved(active);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const value = brain[active] as unknown;

  return (
    <div className="grid gap-6 md:grid-cols-[180px_1fr]">
      <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
        {SECTIONS.map((s) => {
          const count = s.list ? (brain[s.id] as unknown[]).length : null;
          return (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-muted",
                active === s.id ? "bg-muted font-medium" : "text-foreground/75",
              )}
            >
              {s.label}
              <span className="text-xs text-muted-foreground">
                {dirty.has(s.id) ? "•" : count ?? ""}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{section.label}</h2>
            <p className="text-muted-foreground">{section.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {saved === active && <span className="flex items-center gap-1 text-xs text-emerald-600"><Check className="size-3.5" /> Saved</span>}
            <Button onClick={save} disabled={saving || !dirty.has(active)} size="sm">
              {saving && <Loader2 className="animate-spin" />} Save {section.label.toLowerCase()}
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!section.list && (
          <Card>
            <CardContent className="grid gap-4 p-5 md:grid-cols-2">
              {section.fields.map((field) => (
                <FieldInput
                  key={field.key}
                  field={field}
                  value={(value as Item)[field.key]}
                  onChange={(v) => update({ ...(value as Item), [field.key]: v })}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {section.list && (
          <>
            {(value as Item[]).map((item, index) => (
              <Card key={(item.id as string) ?? `new-${index}`}>
                <CardContent className="grid gap-4 p-5 md:grid-cols-2">
                  {section.fields.map((field) => (
                    <FieldInput
                      key={field.key}
                      field={field}
                      value={item[field.key]}
                      onChange={(v) => {
                        const next = [...(value as Item[])];
                        next[index] = { ...item, [field.key]: v };
                        update(next);
                      }}
                    />
                  ))}
                  <div className="flex justify-end md:col-span-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => update((value as Item[]).filter((_, i) => i !== index))}
                    >
                      <Trash2 /> Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" className="self-start" onClick={() => update([...(value as Item[]), { ...section.empty }])}>
              <Plus /> Add {section.itemLabel}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
