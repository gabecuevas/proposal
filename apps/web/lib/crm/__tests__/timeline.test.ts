import { describe, expect, it } from "vitest";
import { CONTACT_FIELD_LABELS } from "../field-labels";
import { diffTrackedFields, timelineToDrawerHistory, type TimelineItem } from "../timeline";

describe("diffTrackedFields address consolidation", () => {
  it("emits a single Address change when address parts change together", () => {
    const changes = diffTrackedFields(
      {
        first_name: "Ada",
        address_line_1: "",
        city: "",
        state: "",
        postal_code: "",
      },
      {
        first_name: "Ada",
        address_line_1: "123 Happy Lane",
        city: "San Jose",
        state: "CA",
        postal_code: "95118",
      },
      CONTACT_FIELD_LABELS,
    );

    expect(changes).toEqual([
      {
        fieldKey: "address",
        fieldLabel: "Address",
        oldValue: "",
        newValue: "123 Happy Lane, San Jose, CA, 95118",
        summary: "Address added",
      },
    ]);
  });

  it("still tracks non-address fields separately", () => {
    const changes = diffTrackedFields(
      { email: "a@example.com", city: "San Jose", state: "CA", postal_code: "95118", address_line_1: "1 Main" },
      { email: "b@example.com", city: "San Jose", state: "CA", postal_code: "95118", address_line_1: "1 Main" },
      CONTACT_FIELD_LABELS,
    );

    expect(changes).toHaveLength(1);
    expect(changes[0]?.fieldKey).toBe("email");
  });
});

describe("timelineToDrawerHistory address consolidation", () => {
  it("merges fragmented address history rows from the same save", () => {
    const at = "2026-09-02T22:42:10.123Z";
    const items: TimelineItem[] = [
      {
        id: "1",
        event_type: "FIELD_CHANGED",
        summary: "Postal code added",
        field_key: "postal_code",
        field_label: "Postal code",
        old_value: null,
        new_value: "95118",
        actor_user_id: "u1",
        actor_name: "Gabe Cuevas",
        activity_id: null,
        created_at: at,
      },
      {
        id: "2",
        event_type: "FIELD_CHANGED",
        summary: "State added",
        field_key: "state",
        field_label: "State",
        old_value: null,
        new_value: "CA",
        actor_user_id: "u1",
        actor_name: "Gabe Cuevas",
        activity_id: null,
        created_at: at,
      },
      {
        id: "3",
        event_type: "FIELD_CHANGED",
        summary: "City added",
        field_key: "city",
        field_label: "City",
        old_value: null,
        new_value: "San Jose",
        actor_user_id: "u1",
        actor_name: "Gabe Cuevas",
        activity_id: null,
        created_at: at,
      },
      {
        id: "4",
        event_type: "FIELD_CHANGED",
        summary: "Address line 1 added",
        field_key: "address_line_1",
        field_label: "Address line 1",
        old_value: null,
        new_value: "123 Happy Lane",
        actor_user_id: "u1",
        actor_name: "Gabe Cuevas",
        activity_id: null,
        created_at: at,
      },
    ];

    const history = timelineToDrawerHistory(items);
    expect(history).toHaveLength(1);
    expect(history[0]?.title).toBe("Address added");
    expect(history[0]?.detail).toBe("123 Happy Lane, San Jose, CA, 95118");
  });
});
