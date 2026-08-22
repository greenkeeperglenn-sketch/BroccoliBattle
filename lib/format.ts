/** "3" for whole numbers, "3.5" otherwise — shared by server and client. */
export function formatUnits(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
