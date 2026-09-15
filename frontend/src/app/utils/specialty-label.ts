export const SPECIALTY_GENITIVE: Record<string, string> = {
  Kardiologija: 'kardiologije',
  Pulmologija: 'pulmologije',
  Endokrinologija: 'endokrinologije',
  Ginekologija: 'ginekologije',
  Pedijatrija: 'pedijatrije',
  Oftalmologija: 'oftalmologije',
  'Otorinolaringologija (ORL)': 'otorinolaringologije',
  Hirurgija: 'hirurgije'
};

export function doctorSpecialtyLabel(specialtyName: string): string {
  const genitive = SPECIALTY_GENITIVE[specialtyName];
  return genitive ? `Lekar specijalista ${genitive}` : `Lekar specijalista ${specialtyName}`;
}

export function specialistTitle(specialtyName: string): string {
  const genitive = SPECIALTY_GENITIVE[specialtyName];
  return genitive ? `Specijalista ${genitive}` : `Specijalista ${specialtyName}`;
}
