/** Put the native caret back after ProseMirror NodeSelection steals it. */
export function revealInputCaret(
  el: HTMLInputElement | HTMLTextAreaElement,
  start: number | null,
  end: number | null,
) {
  el.focus({ preventScroll: true });
  if (typeof start === "number" && typeof end === "number") {
    try {
      el.setSelectionRange(start, end);
    } catch {
      // password / unsupported types reject setSelectionRange
    }
  }
}
