export interface ApiCharacter {
  id: number;
  name: string;
  planetBornOnId?: number | null;
  planetBornOnName?: string | null;
  yearOfBirthEarliest?: number | null;
  yearOfBirthLatest?: number | null;
  yearOfDeathEarliest?: number | null;
  yearOfDeathLatest?: number | null;
  speciesId?: number | null;
  speciesName?: string | null;
}
