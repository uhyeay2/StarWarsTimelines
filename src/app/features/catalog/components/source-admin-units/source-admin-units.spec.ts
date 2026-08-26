import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ApiSourceMaterialUnit } from '../../../../shared/models/api-source-material-unit';
import { AdminUnitsHost, SourceAdminUnits } from './source-admin-units';

describe('SourceAdminUnits', () => {
  const unit = (id: number): ApiSourceMaterialUnit =>
    ({ id, unitType: 'Episode', number: id, title: `Part ${id}` }) as ApiSourceMaterialUnit;

  function host(
    strategy: Record<number, string>,
    unitsByMaterial: Record<number, readonly ApiSourceMaterialUnit[]>,
  ): AdminUnitsHost {
    return {
      unitsByMaterial: () => unitsByMaterial,
      unitEditKey: () => null,
      unitConfirmDeleteKey: () => null,
      unitDeletingKey: () => null,
      unitSavingKey: () => null,
      displayStrategy: () => strategy,
      getDisplayGroups: () => [],
      isSeasonExpanded: () => true,
      toggleSeason: () => undefined,
      unitLabel: (u) => String(u.number),
      nestedChildTypeFor: () => 'Episode',
      openAddUnitPopup: () => undefined,
      beginUnitEdit: () => undefined,
      requestUnitDelete: () => undefined,
      saveUnitEdit: () => undefined,
      cancelUnitEdit: () => undefined,
      confirmUnitDelete: () => undefined,
      cancelUnitDelete: () => undefined,
    };
  }

  function create(
    strategy: Record<number, string>,
    unitsByMaterial: Record<number, readonly ApiSourceMaterialUnit[]>,
  ): ComponentFixture<SourceAdminUnits> {
    const fixture = TestBed.createComponent(SourceAdminUnits);
    fixture.componentRef.setInput('host', host(strategy, unitsByMaterial));
    fixture.componentRef.setInput('materialId', 21);
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SourceAdminUnits, FormsModule],
    }).compileComponents();
  });

  it('renders a flat list when the display strategy is flat', () => {
    const fixture = create({ 21: 'flat' }, { 21: [unit(1), unit(2)] });
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('.unit-item');
    expect(items.length).toBe(2);
  });

  it('shows edit and delete actions for each unit', () => {
    const fixture = create({ 21: 'flat' }, { 21: [unit(1)] });
    fixture.detectChanges();

    const buttons = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.unit-actions button'),
    ].map((b) => b.textContent?.trim());

    expect(buttons).toEqual(['Edit', 'Delete']);
  });
});
