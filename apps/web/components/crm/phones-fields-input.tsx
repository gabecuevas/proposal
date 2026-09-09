"use client";

import { cn } from "@repo/ui/utils";
import {
  PHONE_TYPE_OPTIONS,
  createPhoneId,
  emptyPhoneEntry,
  type PhoneEntry,
  type PhoneType,
} from "@/lib/crm/phones";

type PhonesFieldsInputProps = {
  value: PhoneEntry[];
  className?: string;
  onChange: (value: PhoneEntry[]) => void;
};

const INPUT_CLASS =
  "h-8 w-full rounded-none border border-border bg-white px-2 text-[15px] outline-none ring-primary/15 focus:ring-2";

export function PhonesFieldsInput({ value, className, onChange }: PhonesFieldsInputProps) {
  const rows = value.length > 0 ? value : [emptyPhoneEntry({ primary: true })];

  function updateRow(index: number, patch: Partial<PhoneEntry>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function setPrimary(index: number) {
    onChange(rows.map((row, i) => ({ ...row, primary: i === index })));
  }

  function addPhone() {
    onChange([
      ...rows,
      {
        id: createPhoneId(),
        number: "",
        type: "mobile" as PhoneType,
        primary: rows.length === 0,
      },
    ]);
  }

  function removePhone(index: number) {
    const next = rows.filter((_, i) => i !== index);
    if (next.length === 0) {
      onChange([emptyPhoneEntry({ primary: true })]);
      return;
    }
    if (!next.some((row) => row.primary)) {
      next[0] = { ...next[0]!, primary: true };
    }
    onChange(next);
  }

  return (
    <div className={cn("space-y-3", className)}>
      {rows.map((row, index) => (
        <div key={row.id} className="space-y-1.5 rounded-md border border-border bg-white p-2">
          <div className="flex items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-[13px] text-foreground">
              <input
                type="radio"
                name="primary-phone"
                checked={row.primary}
                onChange={() => setPrimary(index)}
                className="h-3.5 w-3.5 accent-primary"
              />
              Primary
            </label>
            {rows.length > 1 ? (
              <button
                type="button"
                onClick={() => removePhone(index)}
                className="text-xs text-muted hover:text-foreground"
              >
                Remove
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-[1fr_7.5rem] gap-2">
            <input
              autoFocus={index === 0}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className={INPUT_CLASS}
              value={row.number}
              placeholder="Add phone"
              aria-label={row.primary ? "Primary phone number" : "Phone number"}
              onChange={(event) => updateRow(index, { number: event.target.value })}
            />
            <select
              className={cn(INPUT_CLASS, "cursor-pointer")}
              value={row.type}
              aria-label="Phone type"
              onChange={(event) => updateRow(index, { type: event.target.value as PhoneType })}
            >
              {PHONE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addPhone}
        className="text-[13px] font-medium text-primary hover:underline"
      >
        + Add Phone Number
      </button>
    </div>
  );
}
