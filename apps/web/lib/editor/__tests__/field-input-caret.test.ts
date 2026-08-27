/** @vitest-environment happy-dom */

import { describe, expect, it } from "vitest";
import { revealInputCaret } from "../field-input-caret";

describe("revealInputCaret", () => {
  it("focuses the input and places the caret at the given range", () => {
    const input = document.createElement("input");
    input.value = "Hello world";
    document.body.append(input);
    revealInputCaret(input, 6, 6);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(6);
    expect(input.selectionEnd).toBe(6);
    input.remove();
  });
});
