/** Escapes user input so it can be embedded literally in a RegExp. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\\/-]/g, "\\$&");
}
