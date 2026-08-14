import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { LibraryItem } from '../models/library-item';
import { TrackingStatus } from '../models/tracking-status';
import { LIBRARY_SEEDS, SOURCE_MATERIAL_CATALOG } from './library.data';

interface UserLibraryData {
  items: LibraryItem[];
}

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly stores = new Map<string, UserLibraryData>();

  private storeFor(userId: string): UserLibraryData {
    let store = this.stores.get(userId);
    if (!store) {
      const seed = LIBRARY_SEEDS[userId] ?? { items: [] };
      store = { items: seed.items.map((item) => ({ ...item })) };
      this.stores.set(userId, store);
    }
    return store;
  }

  getTracked(userId: string): Observable<readonly LibraryItem[]> {
    return of(this.storeFor(userId).items);
  }

  addTracked(
    userId: string,
    materialId: string,
    status: TrackingStatus = 'Wish Listed',
  ): Observable<readonly LibraryItem[]> {
    const store = this.storeFor(userId);
    if (store.items.some((item) => item.id === materialId)) {
      return of(store.items);
    }
    const material = SOURCE_MATERIAL_CATALOG.find((entry) => entry.id === materialId);
    if (!material) {
      return of(store.items);
    }
    store.items = [
      ...store.items,
      {
        id: material.id,
        title: material.title,
        medium: material.medium,
        status,
        favorite: false,
      },
    ];
    return of(store.items);
  }

  setStatus(
    userId: string,
    materialId: string,
    status: TrackingStatus,
  ): Observable<readonly LibraryItem[]> {
    const store = this.storeFor(userId);
    store.items = store.items.map((item) =>
      item.id === materialId ? { ...item, status } : item,
    );
    return of(store.items);
  }

  toggleFavorite(userId: string, materialId: string): Observable<readonly LibraryItem[]> {
    const store = this.storeFor(userId);
    store.items = store.items.map((item) =>
      item.id === materialId ? { ...item, favorite: !item.favorite } : item,
    );
    return of(store.items);
  }

  removeTracked(userId: string, materialId: string): Observable<readonly LibraryItem[]> {
    const store = this.storeFor(userId);
    store.items = store.items.filter((item) => item.id !== materialId);
    return of(store.items);
  }

  moveTrackedItem(
    userId: string,
    materialId: string,
    direction: -1 | 1,
  ): Observable<readonly LibraryItem[]> {
    const store = this.storeFor(userId);
    const index = store.items.findIndex((item) => item.id === materialId);
    if (index < 0) {
      return of(store.items);
    }
    const status = store.items[index].status;
    const group = store.items
      .map((item, position) => ({ item, position }))
      .filter(({ item }) => item.status === status);
    const groupIndex = group.findIndex(({ item }) => item.id === materialId);
    const targetGroupIndex = groupIndex + direction;
    if (targetGroupIndex < 0 || targetGroupIndex >= group.length) {
      return of(store.items);
    }
    const from = group[groupIndex].position;
    const to = group[targetGroupIndex].position;
    const next = [...store.items];
    [next[from], next[to]] = [next[to], next[from]];
    store.items = next;
    return of(store.items);
  }

  reorderTrackedItem(
    userId: string,
    draggedId: string,
    targetId: string,
  ): Observable<readonly LibraryItem[]> {
    const store = this.storeFor(userId);
    const from = store.items.findIndex((item) => item.id === draggedId);
    const to = store.items.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0 || from === to) {
      return of(store.items);
    }
    const next = [...store.items];
    const [dragged] = next.splice(from, 1);
    next.splice(to, 0, dragged);
    store.items = next;
    return of(store.items);
  }
}
