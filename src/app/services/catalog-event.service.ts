/**
 * @fileoverview Server-sent events (SSE) service for catalog change notifications.
 *
 * Wraps the browser's `EventSource` API to maintain a persistent connection
 * to the backend's `/api/catalog-events` endpoint. When a catalog mutation
 * is broadcast (from any user), the service parses the event and delegates
 * to {@link CatalogService.invalidateEntity} so all consumers see fresh
 * data on their next fetch.
 *
 * Connection lifecycle:
 * - Connects automatically when the user is authenticated.
 * - Disconnects on logout or when the user signal becomes `null`.
 * - Reconnects automatically on transient connection failures (the browser
 *   `EventSource` does this natively with its built-in retry).
 * - Exposes a {@link connected} signal so the UI can show a live-updates
 *   indicator.
 *
 * @see {@link CatalogService} for the cache that gets invalidated.
 * @see {@link CatalogEventBroadcaster} on the backend for the broadcast source.
 */

import { Injectable, effect, inject, OnDestroy, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CatalogService } from './catalog.service';
import { LoggerService } from './logger.service';
import { STORAGE_KEYS, StorageService } from './storage.service';

/** Shape of the JSON payload delivered by the SSE endpoint. */
export interface CatalogEvent {
  entity: string;
  type: 'created' | 'updated' | 'deleted';
  id?: string;
}

/**
 * Maintains a persistent SSE connection for catalog change notifications.
 *
 * This is a root-scoped singleton (`providedIn: 'root'`).
 */
@Injectable({ providedIn: 'root' })
export class CatalogEventService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly catalog = inject(CatalogService);
  private readonly logger = inject(LoggerService);
  private readonly storage = inject(StorageService);

  private eventSource: EventSource | null = null;

  private readonly connectedSignal = signal(false);
  private readonly eventsSubject = new Subject<CatalogEvent>();

  /** Whether the SSE connection is currently open. */
  readonly connected = this.connectedSignal.asReadonly();

  /** Observable stream of parsed catalog events for downstream consumers. */
  readonly events$: Observable<CatalogEvent> = this.eventsSubject.asObservable();

  constructor() {
    effect(() => {
      const user = this.auth.currentUser();
      if (user) {
        this.connect();
      } else {
        this.disconnect();
      }
    });
  }

  /**
   * Cleans up the SSE connection on service destruction.
   */
  ngOnDestroy(): void {
    this.disconnect();
    this.eventsSubject.complete();
  }

  /**
   * Opens the SSE connection to the catalog-events endpoint.
   *
   * The JWT access token is passed as a query parameter because `EventSource`
   * does not support custom headers. ASP.NET Core's JWT bearer handler reads
   * `access_token` from the query string by default.
   */
  private connect(): void {
    if (this.eventSource) {
      return;
    }

    const token = this.storage.getItem(STORAGE_KEYS.token);
    if (!token) {
      return;
    }

    const url = `${environment.apiBaseUrl}/api/catalog-events?access_token=${encodeURIComponent(token)}`;

    this.logger.info('[CatalogEventService] Connecting to SSE endpoint');
    const source = new EventSource(url);

    source.onopen = () => {
      this.connectedSignal.set(true);
    };

    source.onmessage = (event: MessageEvent) => {
      try {
        const catalogEvent = JSON.parse(event.data) as CatalogEvent;
        if (!catalogEvent.entity) {
          return;
        }
        this.logger.debug('[CatalogEventService] Received event', catalogEvent);
        this.catalog.invalidateEntity(catalogEvent.entity, catalogEvent.id);
        this.eventsSubject.next(catalogEvent);
      } catch (err) {
        this.logger.warn('[CatalogEventService] Failed to parse SSE event', err);
      }
    };

    source.onerror = () => {
      this.connectedSignal.set(false);
      this.logger.warn('[CatalogEventService] SSE connection error — browser will auto-reconnect');
    };

    this.eventSource = source;
  }

  /**
   * Closes the current SSE connection, if any.
   */
  private disconnect(): void {
    if (this.eventSource) {
      this.logger.info('[CatalogEventService] Disconnecting from SSE endpoint');
      this.eventSource.close();
      this.eventSource = null;
      this.connectedSignal.set(false);
    }
  }
}
