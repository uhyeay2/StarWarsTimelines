import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SourceMaterialPopups, SourcePopupsHost } from './source-material-popups';

describe('SourceMaterialPopups', () => {
  function host(overrides: Partial<SourcePopupsHost>): SourcePopupsHost {
    return {
      isAdmin: () => false,
      addMaterialMedium: () => null,
      addError: () => null,
      adding: () => false,
      submitAddMaterial: () => undefined,
      cancelAddMaterial: () => undefined,
      bookChoiceMaterialId: () => null,
      chooseBookChapter: () => undefined,
      requestStartCollection: () => undefined,
      cancelBookChoice: () => undefined,
      unitPopupContext: () => null,
      unitPopupHeading: () => '',
      unitAddError: () => null,
      addingUnitFor: () => null,
      submitAddUnit: () => undefined,
      cancelAddUnit: () => undefined,
      convertPopupMaterialId: () => null,
      convertingId: () => null,
      submitConvert: () => undefined,
      cancelConvert: () => undefined,
      startCollectionMaterialId: () => null,
      startingCollectionFor: () => null,
      submitStartCollection: () => undefined,
      cancelStartCollection: () => undefined,
      ...overrides,
    };
  }

  function create(h: SourcePopupsHost): ComponentFixture<SourceMaterialPopups> {
    const fixture = TestBed.createComponent(SourceMaterialPopups);
    fixture.componentRef.setInput('host', h);
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SourceMaterialPopups],
    }).compileComponents();
  });

  it('renders nothing for non-admin users', () => {
    const fixture = create(host({ isAdmin: () => false, addMaterialMedium: () => 'Book' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-material-add-dialog')).toBeNull();
  });

  it('renders the material dialog for admins when a medium popup is open', () => {
    const fixture = create(host({ isAdmin: () => true, addMaterialMedium: () => 'Book' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-material-add-dialog')).not.toBeNull();
  });
});
