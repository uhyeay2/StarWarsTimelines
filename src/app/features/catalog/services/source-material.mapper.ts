/**
 * @fileoverview Pure mapping functions for source-material DTOs.
 * Converts wire-format DTOs (with numeric enum codes) into domain-level
 * interfaces (with string unions).
 */
import { ApiSourceMaterial } from '../../../shared/models/api-source-material';
import { ApiSourceMaterialUnit } from '../../../shared/models/api-source-material-unit';
import { canonTypeFromApiCode } from '../../../shared/models/canon-type';
import { mediumFromApiCode } from '../../../shared/models/medium';
import { unitTypeFromApiCode } from '../../../shared/models/unit-type';
import { SourceMaterialDto, SourceMaterialUnitDto } from './catalog.dto';

/**
 * Maps a single {@link SourceMaterialDto} to a domain-level {@link ApiSourceMaterial}.
 * @param item - The raw DTO from the API.
 */
export function mapSourceMaterial(item: SourceMaterialDto): ApiSourceMaterial {
  return {
    id: item.id,
    title: item.title,
    medium: mediumFromApiCode(item.medium),
    canonType: canonTypeFromApiCode(item.canonType),
  };
}

/**
 * Maps a single {@link SourceMaterialUnitDto} to a domain-level {@link ApiSourceMaterialUnit}.
 * @param item - The raw DTO from the API.
 */
export function mapUnit(item: SourceMaterialUnitDto): ApiSourceMaterialUnit {
  return {
    id: item.id,
    sourceMaterialId: item.sourceMaterialId,
    unitType: unitTypeFromApiCode(item.unitType),
    number: item.number,
    title: item.title,
    parentUnitId: item.parentUnitId,
  };
}
