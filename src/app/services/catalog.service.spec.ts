import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CatalogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches source materials and maps numeric enums', async () => {
    const result = firstValueFrom(service.getSourceMaterials());

    const request = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'));
    request.flush([
      {
        id: '00000000-0000-0000-0000-000000000004',
        title: 'Star Wars: Episode IV - A New Hope',
        medium: 0,
        canonType: 0,
      },
      {
        id: '00000000-0000-0000-0000-000000000006',
        title: 'Star Wars: Episode V - The Empire Strikes Back',
        medium: 0,
        canonType: 2,
      },
    ]);

    await expect(result).resolves.toEqual([
      {
        id: '00000000-0000-0000-0000-000000000004',
        title: 'Star Wars: Episode IV - A New Hope',
        medium: 'Movie',
        canonType: 'Canon',
      },
      {
        id: '00000000-0000-0000-0000-000000000006',
        title: 'Star Wars: Episode V - The Empire Strikes Back',
        medium: 'Movie',
        canonType: 'Canon & Legends',
      },
    ]);
  });

  it('throws when a source material has an unknown medium code', async () => {
    const result = firstValueFrom(service.getSourceMaterials());

    const request = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/source-materials'));
    request.flush([{ id: '00000000-0000-0000-0000-000000000001', title: 'Unknown', medium: 99, canonType: 0 }]);

    await expect(result).rejects.toThrow('Unknown medium code: 99');
  });

  it('fetches characters', async () => {
    const result = firstValueFrom(service.getCharacters());

    const request = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/characters'));
    request.flush([{ id: '00000000-0000-0000-0000-100000000001', name: 'Luke Skywalker' }]);

    await expect(result).resolves.toEqual([
      { id: '00000000-0000-0000-0000-100000000001', name: 'Luke Skywalker' },
    ]);
  });

  it('fetches locations', async () => {
    const result = firstValueFrom(service.getLocations());

    const request = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/locations'));
    request.flush([{ id: '00000000-0000-0000-0000-200000000001', name: 'Tatooine' }]);

    await expect(result).resolves.toEqual([
      { id: '00000000-0000-0000-0000-200000000001', name: 'Tatooine' },
    ]);
  });

  it('fetches vehicles', async () => {
    const result = firstValueFrom(service.getVehicles());

    const request = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/vehicles'));
    request.flush([{ id: '00000000-0000-0000-0000-300000000001', name: 'Millennium Falcon' }]);

    await expect(result).resolves.toEqual([
      { id: '00000000-0000-0000-0000-300000000001', name: 'Millennium Falcon' },
    ]);
  });

  it('fetches units and maps the numeric unit type', async () => {
    const result = firstValueFrom(service.getSourceMaterialUnits('00000000-0000-0000-0000-000000000012'));

    const request = httpMock.expectOne(
      (r) => r.method === 'GET' && r.url.endsWith('/api/source-materials/00000000-0000-0000-0000-000000000012/units'),
    );
    request.flush([
      {
        id: '00000000-0000-0000-0000-500000000025',
        sourceMaterialId: '00000000-0000-0000-0000-000000000012',
        unitType: 0,
        groupNumber: 1,
        number: 1,
        title: 'Chapter 1: The Mandalorian',
      },
      {
        id: '00000000-0000-0000-0000-500000000037',
        sourceMaterialId: '00000000-0000-0000-0000-000000000019',
        unitType: 1,
        groupNumber: null,
        number: 2,
        title: null,
      },
    ]);

    await expect(result).resolves.toEqual([
      {
        id: '00000000-0000-0000-0000-500000000025',
        sourceMaterialId: '00000000-0000-0000-0000-000000000012',
        unitType: 'Episode',
        groupNumber: 1,
        number: 1,
        title: 'Chapter 1: The Mandalorian',
      },
      {
        id: '00000000-0000-0000-0000-500000000037',
        sourceMaterialId: '00000000-0000-0000-0000-000000000019',
        unitType: 'Chapter',
        groupNumber: null,
        number: 2,
        title: null,
      },
    ]);
  });

  it('creates a character with the posted name', async () => {
    const result = firstValueFrom(service.createCharacter('Luke Skywalker'));

    const request = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/characters'));
    expect(request.request.body).toEqual({ name: 'Luke Skywalker' });
    request.flush({ id: '00000000-0000-0000-0000-100000000099', name: 'Luke Skywalker' });

    await expect(result).resolves.toEqual({
      id: '00000000-0000-0000-0000-100000000099',
      name: 'Luke Skywalker',
    });
  });

  it('updates a character with the posted name', async () => {
    const result = firstValueFrom(service.updateCharacter('00000000-0000-0000-0000-100000000001', 'New name'));

    const request = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/characters/00000000-0000-0000-0000-100000000001'));
    expect(request.request.body).toEqual({ name: 'New name' });
    request.flush({ id: '00000000-0000-0000-0000-100000000001', name: 'New name' });

    await expect(result).resolves.toEqual({
      id: '00000000-0000-0000-0000-100000000001',
      name: 'New name',
    });
  });

  it('deletes a character and completes', async () => {
    const result = firstValueFrom(service.deleteCharacter('00000000-0000-0000-0000-100000000001'));

    const request = httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/api/characters/00000000-0000-0000-0000-100000000001'));
    request.flush(null, { status: 204, statusText: 'No Content' });

    await expect(result).resolves.toBeNull();
  });

  it('surfaces the problem detail when deleting a referenced character', async () => {
    const result = firstValueFrom(service.deleteCharacter('00000000-0000-0000-0000-100000000001'));

    const request = httpMock.expectOne((r) => r.method === 'DELETE');
    request.flush(
      { title: 'Conflict', detail: 'Character is linked to one or more timeline events.' },
      { status: 409, statusText: 'Conflict' },
    );

    await expect(result).rejects.toThrow('Character is linked to one or more timeline events.');
  });

  it('creates a source material with mapped enum codes', async () => {
    const result = firstValueFrom(
      service.createSourceMaterial({ title: 'Ahsoka', medium: 'Live Action Show', canonType: 'Canon' }),
    );

    const request = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/source-materials'));
    expect(request.request.body).toEqual({ title: 'Ahsoka', medium: 4, canonType: 0 });
    request.flush({ id: '00000000-0000-0000-0000-000000000099', title: 'Ahsoka', medium: 4, canonType: 0 });

    await expect(result).resolves.toEqual({
      id: '00000000-0000-0000-0000-000000000099',
      title: 'Ahsoka',
      medium: 'Live Action Show',
      canonType: 'Canon',
    });
  });

  it('updates a source material with mapped enum codes', async () => {
    const result = firstValueFrom(
      service.updateSourceMaterial('00000000-0000-0000-0000-000000000099', {
        title: 'Ahsoka S2',
        medium: 'Live Action Show',
        canonType: 'Legends',
      }),
    );

    const request = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/source-materials/00000000-0000-0000-0000-000000000099'));
    expect(request.request.body).toEqual({ title: 'Ahsoka S2', medium: 4, canonType: 1 });
    request.flush({ id: '00000000-0000-0000-0000-000000000099', title: 'Ahsoka S2', medium: 4, canonType: 1 });

    await expect(result).resolves.toEqual({
      id: '00000000-0000-0000-0000-000000000099',
      title: 'Ahsoka S2',
      medium: 'Live Action Show',
      canonType: 'Legends',
    });
  });

  it('creates a unit with the posted payload and maps the unit type', async () => {
    const result = firstValueFrom(
      service.createSourceMaterialUnit('00000000-0000-0000-0000-000000000012', {
        unitType: 'Episode',
        groupNumber: 2,
        number: 9,
        title: null,
      }),
    );

    const request = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/api/source-materials/00000000-0000-0000-0000-000000000012/units'));
    expect(request.request.body).toEqual({ unitType: 0, groupNumber: 2, number: 9, title: null });
    request.flush({
      id: '00000000-0000-0000-0000-500000000099',
      sourceMaterialId: '00000000-0000-0000-0000-000000000012',
      unitType: 0,
      groupNumber: 2,
      number: 9,
      title: null,
    });

    await expect(result).resolves.toEqual({
      id: '00000000-0000-0000-0000-500000000099',
      sourceMaterialId: '00000000-0000-0000-0000-000000000012',
      unitType: 'Episode',
      groupNumber: 2,
      number: 9,
      title: null,
    });
  });

  it('deletes a unit and completes', async () => {
    const result = firstValueFrom(
      service.deleteSourceMaterialUnit('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-500000000099'),
    );

    const request = httpMock.expectOne(
      (r) => r.method === 'DELETE' && r.url.endsWith('/api/source-materials/00000000-0000-0000-0000-000000000012/units/00000000-0000-0000-0000-500000000099'),
    );
    request.flush(null, { status: 204, statusText: 'No Content' });

    await expect(result).resolves.toBeNull();
  });
});
