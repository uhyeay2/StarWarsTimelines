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
});
