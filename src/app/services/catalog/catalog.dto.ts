/**
 * @fileoverview Internal wire-type DTOs for the catalog API.
 *
 * These interfaces represent the raw JSON shapes returned by the ASP.NET Core
 * backend. They use numeric enum codes rather than the domain-level string
 * unions used throughout the Angular application.
 *
 * @see {@link CatalogService} for the service that consumes these DTOs.
 */

/**
 * Response body of the source-material endpoints.
 *
 * The `medium` and `canonType` fields are numeric indices into the server-side
 * enums.
 */
export interface SourceMaterialDto {
  id: string;
  title: string;
  medium: number;
  canonType: number;
}

/**
 * Response body of the source-material-unit endpoints.
 *
 * The `unitType` field is a numeric index into the server-side enum.
 * `parentUnitId` points at the container unit this unit nests inside,
 * or is `null` for top-level units.
 */
export interface SourceMaterialUnitDto {
  id: string;
  sourceMaterialId: string;
  unitType: number;
  groupNumber: number | null;
  number: number;
  title: string | null;
  parentUnitId: string | null;
}
