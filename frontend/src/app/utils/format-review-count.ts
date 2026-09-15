export function formatReviewCountLabel(count: number): string {
  const abs = Math.abs(Math.trunc(count));
  const mod100 = abs % 100;
  const mod10 = abs % 10;

  if (mod10 === 1 && mod100 !== 11) {
    return `${abs} ocena`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${abs} ocene`;
  }

  return `${abs} ocena`;
}
