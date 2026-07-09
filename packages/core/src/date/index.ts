export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}
