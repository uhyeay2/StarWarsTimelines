import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SourceMaterialUnits, SourceUnitsHost } from './source-material-units';

describe('SourceMaterialUnits', () => {
  function host(overrides: Partial<SourceUnitsHost>): SourceUnitsHost {
    return {
      isAdmin: () => true,
      unitsLoading: () => false,
      unitsError: () => null,
      showsUnitsFor: () => true,
      unitsByMaterial: () => ({}),
      currentUser: () => null,
      unitEditKey: () => null,
      unitConfirmDeleteKey: () => null,
      unitDeletingKey: () => null,
      unitSavingKey: () => null,
      displayStrategy: () => ({ 21: 'flat' }),
      getDisplayGroups: () => [],
      isSeasonExpanded: () => false,
      toggleSeason: () => undefined,
      unitLabel: () => '',
      materialTracksViaContainers: () => false,
      nestedChildTypeFor: () => 'Episode',
      openAddUnitPopup: () => undefined,
      beginUnitEdit: () => undefined,
      requestUnitDelete: () => undefined,
      saveUnitEdit: () => undefined,
      cancelUnitEdit: () => undefined,
      confirmUnitDelete: () => undefined,
      cancelUnitDelete: () => undefined,
      getGroupTrackingOptions: () => [],
      getGroupCurrentStatus: () => null,
      onTrackGroupUnit: () => undefined,
      ...overrides,
    };
  }

  function create(h: SourceUnitsHost): ComponentFixture<SourceMaterialUnits> {
    const fixture = TestBed.createComponent(SourceMaterialUnits);
    fixture.componentRef.setInput('host', h);
    fixture.componentRef.setInput('materialId', 21);
    fixture.componentRef.setInput('medium', 'Book');
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SourceMaterialUnits],
    }).compileComponents();
  });

  it('renders nothing when the host hides the section', () => {
    const fixture = create(host({ showsUnitsFor: () => false }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.unit')).toBeNull();
  });

  it('renders the admin view for admin users', () => {
    const fixture = create(host({ isAdmin: () => true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.unit')).not.toBeNull();
  });

  it('shows the error state instead of units when loading failed', () => {
    const fixture = create(host({ unitsError: () => 'Units unavailable' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Units unavailable');
  });
});
