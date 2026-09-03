"use client";

import { cn } from "@repo/ui/utils";
import type { AddressValues } from "@/lib/crm/address";

type AddressFieldsInputProps = {
  value: AddressValues;
  className?: string;
  onChange: (value: AddressValues) => void;
};

const INPUT_CLASS =
  "h-8 w-full rounded-none border border-border bg-white px-2 text-[15px] outline-none ring-primary/15 focus:ring-2";

export function AddressFieldsInput({ value, className, onChange }: AddressFieldsInputProps) {
  function update<K extends keyof AddressValues>(key: K, next: string) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Street address</label>
        <input
          autoFocus
          type="text"
          autoComplete="street-address"
          className={INPUT_CLASS}
          value={value.address_line_1}
          placeholder="Street address"
          onChange={(event) => update("address_line_1", event.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">City</label>
          <input
            type="text"
            autoComplete="address-level2"
            className={INPUT_CLASS}
            value={value.city}
            placeholder="City"
            onChange={(event) => update("city", event.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">State</label>
          <input
            type="text"
            autoComplete="address-level1"
            className={INPUT_CLASS}
            value={value.state}
            placeholder="State"
            onChange={(event) => update("state", event.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Zip code</label>
        <input
          type="text"
          autoComplete="postal-code"
          className={INPUT_CLASS}
          value={value.postal_code}
          placeholder="Zip code"
          onChange={(event) => update("postal_code", event.target.value)}
        />
      </div>
    </div>
  );
}
