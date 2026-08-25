/**
 * @fileoverview Internal wire-type DTOs for the catalog API.
 *
 * These interfaces represent the raw JSON shapes returned by the ASP.NET Core
 * backend. They use numeric enum codes rather than the domain-level string
 * unions used throughout the Angular application.
 *
 * @see {@link SourceMaterialService} for the service that consumes these DTOs.
 */

/**
 * Response body of the source-material endpoints.
 *
 * The `medium` and `canonType` fields are numeric indices into the server-side
 * enums.
 */
export interface SourceMaterialDto {
  readonly id: number;
  readonly title: string;
  readonly medium: number;
  readonly canonType: number;
}

/**
 * Response body of the source-material-unit endpoints.
 *
 * The `unitType` field is a numeric index into the server-side enum.
 * `parentUnitId` points at the container unit this unit nests inside,
 * or is `null` for top-level units.
 */
export interface SourceMaterialUnitDto {
  readonly id: number;
  readonly sourceMaterialId: number;
  readonly unitType: number;
  readonly number: number;
  readonly title: string | null;
  readonly parentUnitId: number | null;
}
