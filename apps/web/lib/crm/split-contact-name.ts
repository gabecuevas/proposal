export function splitContactName(value: string): { first_name: string; last_name: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { first_name: "", last_name: "" };
  }
  const space = trimmed.indexOf(" ");
  if (space === -1) {
    return { first_name: trimmed, last_name: "" };
  }
  return {
    first_name: trimmed.slice(0, space),
    last_name: trimmed.slice(space + 1).trimStart(),
  };
}
