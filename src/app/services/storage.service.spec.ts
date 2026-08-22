import { TestBed } from '@angular/core/testing';
import { STORAGE_KEYS, StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    sessionStorage.clear();
    service = TestBed.inject(StorageService);
  });

  it('round-trips values through sessionStorage', () => {
    service.setItem(STORAGE_KEYS.token, 'jwt-value');

    expect(service.getItem(STORAGE_KEYS.token)).toBe('jwt-value');
    expect(sessionStorage.getItem(STORAGE_KEYS.token)).toBe('jwt-value');
  });

  it('returns null for missing keys', () => {
    expect(service.getItem(STORAGE_KEYS.token)).toBeNull();
  });

  it('removes a single key', () => {
    service.setItem(STORAGE_KEYS.token, 'jwt-value');
    service.setItem(STORAGE_KEYS.user, '{}');

    service.removeItem(STORAGE_KEYS.token);

    expect(service.getItem(STORAGE_KEYS.token)).toBeNull();
    expect(service.getItem(STORAGE_KEYS.user)).toBe('{}');
  });

  it('clears all keys', () => {
    service.setItem(STORAGE_KEYS.token, 'jwt-value');
    service.setItem(STORAGE_KEYS.refreshToken, 'refresh-value');

    service.clear();

    expect(service.getItem(STORAGE_KEYS.token)).toBeNull();
    expect(service.getItem(STORAGE_KEYS.refreshToken)).toBeNull();
  });
});
