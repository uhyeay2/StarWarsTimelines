export interface ApiCharacter {
  id: string;
  name: string;
  planetBornOnId?: string | null;
  planetBornOnName?: string | null;
  yearOfBirthEarliest?: number | null;
  yearOfBirthLatest?: number | null;
  yearOfDeathEarliest?: number | null;
  yearOfDeathLatest?: number | null;
  speciesId?: string | null;
  speciesName?: string | null;
}
