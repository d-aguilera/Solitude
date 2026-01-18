export function rgbToCss({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}): string {
  return `rgb(${r}, ${g}, ${b})`;
}
