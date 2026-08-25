import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { User } from '../../../shared/models/user';
import { AuthService } from '../../auth/services/auth.service';
import { CatalogInvalidator } from '../../catalog/services/catalog-invalidator.service';
import { LoggerService } from '../../../shared/services/logging/logger.service';
import { STORAGE_KEYS, StorageService } from '../../../shared/services/storage.service';
import { CatalogEventService } from './catalog-event.service';

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  simulateOpen(): void {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  simulateMessage(data: string): void {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  simulateError(): void {
    this.onerror?.();
  }

  static reset(): void {
    MockEventSource.instances = [];
  }
}

// Store reference and replace global EventSource.
const OriginalEventSource = globalThis.EventSource;

function installMockEventSource(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis['EventSource'] = MockEventSource as any;
}

function uninstallMockEventSource(): void {
  if (OriginalEventSource) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis['EventSource'] = OriginalEventSource as any;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis['EventSource'] = undefined as any;
  }
}

const USER: User = {
  id: 'user-1',
  username: 'testuser',
  displayName: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  role: 'Standard',
};

describe('CatalogEventService', () => {
  let authSignal: ReturnType<typeof signal<User | null>>;
  let invalidateEntitySpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    MockEventSource.reset();
    installMockEventSource();
    sessionStorage.clear();
    sessionStorage.setItem(STORAGE_KEYS.token, 'fake-jwt-token');

    authSignal = signal<User | null>(null);
    invalidateEntitySpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser: authSignal.asReadonly() } },
        {
          provide: CatalogInvalidator,
          useValue: { invalidateEntity: invalidateEntitySpy },
        },
        {
          provide: LoggerService,
          useValue: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
        },
        { provide: StorageService, useValue: new StorageService() },
      ],
    });
  });

  afterEach(() => {
    uninstallMockEventSource();
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('creates the service', () => {
    TestBed.inject(CatalogEventService);
  });

  it('connects when the user is authenticated', () => {
    TestBed.inject(CatalogEventService);

    authSignal.set(USER);
    TestBed.flushEffects();

    expect(MockEventSource.instances.length).toBe(1);
    expect(MockEventSource.instances[0]!.url).toContain('/api/catalog-events?access_token=');
    expect(MockEventSource.instances[0]!.url).toContain('fake-jwt-token');
  });

  it('does not connect when there is no token', () => {
    sessionStorage.removeItem(STORAGE_KEYS.token);
    TestBed.inject(CatalogEventService);

    authSignal.set(USER);
    TestBed.flushEffects();

    expect(MockEventSource.instances.length).toBe(0);
  });

  it('disconnects when the user logs out', () => {
    TestBed.inject(CatalogEventService);

    authSignal.set(USER);
    TestBed.flushEffects();
    expect(MockEventSource.instances.length).toBe(1);

    const instance = MockEventSource.instances[0]!;

    authSignal.set(null);
    TestBed.flushEffects();

    expect(instance.close).toHaveBeenCalled();
  });

  it('does not create a second connection if already connected', () => {
    TestBed.inject(CatalogEventService);

    authSignal.set(USER);
    TestBed.flushEffects();
    authSignal.set(USER);
    TestBed.flushEffects();

    expect(MockEventSource.instances.length).toBe(1);
  });

  it('passes the event ID to invalidateEntity', () => {
    TestBed.inject(CatalogEventService);

    authSignal.set(USER);
    TestBed.flushEffects();

    MockEventSource.instances[0]!.simulateMessage(
      JSON.stringify({ entity: 'characters', type: 'created', id: 'char-1' }),
    );

    expect(invalidateEntitySpy).toHaveBeenCalledWith('characters', 'char-1');
  });

  it('passes undefined ID when the event has no id field', () => {
    TestBed.inject(CatalogEventService);

    authSignal.set(USER);
    TestBed.flushEffects();

    MockEventSource.instances[0]!.simulateMessage(
      JSON.stringify({ entity: 'characters', type: 'created' }),
    );

    expect(invalidateEntitySpy).toHaveBeenCalledWith('characters', undefined);
  });

  it('handles malformed event data without crashing', () => {
    TestBed.inject(CatalogEventService);

    authSignal.set(USER);
    TestBed.flushEffects();

    expect(() => {
      MockEventSource.instances[0]!.simulateMessage('not json');
    }).not.toThrow();

    expect(invalidateEntitySpy).not.toHaveBeenCalled();
  });

  it('does not invalidate when the event has no entity field', () => {
    TestBed.inject(CatalogEventService);

    authSignal.set(USER);
    TestBed.flushEffects();

    MockEventSource.instances[0]!.simulateMessage(JSON.stringify({ type: 'created' }));

    expect(invalidateEntitySpy).not.toHaveBeenCalled();
  });

  it('disconnects on ngOnDestroy', () => {
    const service = TestBed.inject(CatalogEventService);

    authSignal.set(USER);
    TestBed.flushEffects();
    const instance = MockEventSource.instances[0]!;

    service.ngOnDestroy();

    expect(instance.close).toHaveBeenCalled();
  });

  it('URL-encodes the access token', () => {
    sessionStorage.setItem(STORAGE_KEYS.token, 'token with spaces');
    TestBed.inject(CatalogEventService);

    authSignal.set(USER);
    TestBed.flushEffects();

    expect(MockEventSource.instances[0]!.url).toContain('access_token=token%20with%20spaces');
  });

  describe('connected signal', () => {
    it('is false by default', () => {
      const service = TestBed.inject(CatalogEventService);
      expect(service.connected()).toBe(false);
    });

    it('becomes true when the EventSource opens', () => {
      const service = TestBed.inject(CatalogEventService);

      authSignal.set(USER);
      TestBed.flushEffects();

      MockEventSource.instances[0]!.simulateOpen();

      expect(service.connected()).toBe(true);
    });

    it('becomes false on EventSource error', () => {
      const service = TestBed.inject(CatalogEventService);

      authSignal.set(USER);
      TestBed.flushEffects();
      MockEventSource.instances[0]!.simulateOpen();
      expect(service.connected()).toBe(true);

      MockEventSource.instances[0]!.simulateError();

      expect(service.connected()).toBe(false);
    });

    it('becomes false when the user logs out', () => {
      const service = TestBed.inject(CatalogEventService);

      authSignal.set(USER);
      TestBed.flushEffects();
      MockEventSource.instances[0]!.simulateOpen();
      expect(service.connected()).toBe(true);

      authSignal.set(null);
      TestBed.flushEffects();

      expect(service.connected()).toBe(false);
    });
  });

  describe('events$ observable', () => {
    it('emits parsed events to subscribers', async () => {
      const service = TestBed.inject(CatalogEventService);

      authSignal.set(USER);
      TestBed.flushEffects();

      const eventPromise = firstValueFrom(service.events$);

      MockEventSource.instances[0]!.simulateMessage(
        JSON.stringify({ entity: 'characters', type: 'created', id: 'char-1' }),
      );

      const event = await eventPromise;
      expect(event).toEqual({ entity: 'characters', type: 'created', id: 'char-1' });
    });

    it('does not emit for events without an entity field', async () => {
      const service = TestBed.inject(CatalogEventService);

      authSignal.set(USER);
      TestBed.flushEffects();

      let emitted = false;
      service.events$.subscribe(() => {
        emitted = true;
      });

      MockEventSource.instances[0]!.simulateMessage(JSON.stringify({ type: 'created' }));

      expect(emitted).toBe(false);
    });
  });
});
