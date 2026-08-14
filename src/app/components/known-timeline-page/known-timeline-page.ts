import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LibraryItem } from '../../models/library-item';
import { AuthService } from '../../services/auth.service';
import { LibraryService } from '../../services/library.service';
import { Timeline } from '../timeline/timeline';

@Component({
  selector: 'app-known-timeline-page',
  imports: [Timeline, RouterLink],
  templateUrl: './known-timeline-page.html',
  styleUrl: './known-timeline-page.scss',
})
export class KnownTimelinePage {
  private readonly auth = inject(AuthService);
  private readonly libraryService = inject(LibraryService);

  readonly user = toSignal(this.auth.currentUser$);
  readonly userId = computed(() => this.user()?.id ?? null);
  readonly tracked = signal<readonly LibraryItem[]>([]);

  readonly includeCompleted = signal(true);
  readonly includeInProgress = signal(false);
  readonly includeWishListed = signal(false);

  readonly consumedIds = computed(() => {
    const ids = new Set<string>();
    for (const item of this.tracked()) {
      const included =
        (item.status === 'Completed' && this.includeCompleted()) ||
        (item.status === 'In progress' && this.includeInProgress()) ||
        (item.status === 'Wish Listed' && this.includeWishListed());
      if (included) {
        ids.add(item.id);
      }
    }
    return [...ids];
  });

  constructor() {
    effect((onCleanup) => {
      const userId = this.userId();
      if (!userId) {
        this.tracked.set([]);
        return;
      }
      const subscription = this.libraryService
        .getTracked(userId)
        .subscribe((items) => this.tracked.set(items));
      onCleanup(() => subscription.unsubscribe());
    });
  }

  toggleStatus(key: 'completed' | 'inProgress' | 'wishListed'): void {
    if (key === 'completed') {
      this.includeCompleted.update((value) => !value);
    } else if (key === 'inProgress') {
      this.includeInProgress.update((value) => !value);
    } else {
      this.includeWishListed.update((value) => !value);
    }
  }
}
