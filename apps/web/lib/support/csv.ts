/** Prefix cells that could be interpreted as formulas in Excel/Sheets. */
export function csvEscapeCell(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let cell = normalized;
  if (/^[=+\-@\t\r]/.test(cell)) {
    cell = `'${cell}`;
  }
  if (cell.includes('"') || cell.includes(",") || cell.includes("\n")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export function rowsToCsv(headers: string[], rows: string[][]): string {
  const lines = [
    headers.map(csvEscapeCell).join(","),
    ...rows.map((row) => row.map((cell) => csvEscapeCell(cell ?? "")).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}
