export interface ApiSpecies {
  readonly id: number;
  readonly name: string;
  readonly homePlanetId: number | null;
  readonly homePlanetName: string | null;
}
