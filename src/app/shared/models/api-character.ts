export interface ApiCharacter {
  readonly id: number;
  readonly name: string;
  readonly bornOnPlanetId?: number | null;
  readonly bornOnPlanetName?: string | null;
  readonly yearOfBirthEarliest?: number | null;
  readonly yearOfBirthLatest?: number | null;
  readonly yearOfDeathEarliest?: number | null;
  readonly yearOfDeathLatest?: number | null;
  readonly speciesId?: number | null;
  readonly speciesName?: string | null;
}
