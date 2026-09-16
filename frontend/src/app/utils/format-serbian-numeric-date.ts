export function formatSerbianNumericDate(isoDate: string | null | undefined): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return 'nije dostupno';
  }

  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) {
    return 'nije dostupno';
  }

  return `${day}. ${month}. ${year}.`;
}

export function patientInitials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toLocaleUpperCase('sr-Latn');
}
