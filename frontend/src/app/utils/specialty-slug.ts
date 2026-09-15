export const SPECIALTY_NAME_BY_SLUG: Record<string, string> = {
  kardiologija: 'Kardiologija',
  pulmologija: 'Pulmologija',
  endokrinologija: 'Endokrinologija',
  ginekologija: 'Ginekologija',
  pedijatrija: 'Pedijatrija',
  oftalmologija: 'Oftalmologija',
  otorinolaringologija: 'Otorinolaringologija (ORL)',
  hirurgija: 'Hirurgija'
};

export function slugFromSpecialtyName(name: string): string | null {
  const match = Object.entries(SPECIALTY_NAME_BY_SLUG).find(([, specialtyName]) => {
    return specialtyName === name;
  });

  return match ? match[0] : null;
}
