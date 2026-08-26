import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiSourceMaterialUnit } from '../../../../shared/models/api-source-material-unit';
import { NonAdminUnitsHost, SourceNonAdminUnits } from './source-nonadmin-units';

describe('SourceNonAdminUnits', () => {
  const unit = (id: number): ApiSourceMaterialUnit =>
    ({ id, unitType: 'Chapter', number: id, title: `Chapter ${id}` }) as ApiSourceMaterialUnit;

  function host(
    unitsByMaterial: Record<number, readonly ApiSourceMaterialUnit[]>,
  ): NonAdminUnitsHost {
    return {
      unitsByMaterial: () => unitsByMaterial,
      getDisplayGroups: () => [],
      isSeasonExpanded: () => false,
      toggleSeason: () => undefined,
      unitLabel: (unit) => String(unit.number),
      materialTracksViaContainers: () => false,
      getGroupTrackingOptions: () => [],
      getGroupCurrentStatus: () => null,
      onTrackGroupUnit: () => undefined,
    };
  }

  function create(
    medium: string,
    unitsByMaterial: Record<number, readonly ApiSourceMaterialUnit[]>,
  ): ComponentFixture<SourceNonAdminUnits> {
    const fixture = TestBed.createComponent(SourceNonAdminUnits);
    fixture.componentRef.setInput('host', host(unitsByMaterial));
    fixture.componentRef.setInput('materialId', 21);
    fixture.componentRef.setInput('medium', medium);
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SourceNonAdminUnits],
    }).compileComponents();
  });

  it('renders nothing for movies', () => {
    const fixture = create('Movie', { 21: [unit(1)] });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.unit-list')).toBeNull();
  });

  it('lists book units flat', () => {
    const fixture = create('Video Game', { 21: [unit(1), unit(2)] });
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('.unit-item');
    expect(items.length).toBe(2);
  });
});
