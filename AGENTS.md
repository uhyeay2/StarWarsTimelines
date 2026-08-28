# AGENTS.md — StarWarsTimelines

> Guidelines for AI agents and contributors working on this codebase.
> Follow these conventions to maintain consistency and quality.

---

## Commands

```bash
# Development
npm start                    # Dev server on https://localhost:7089

# Build
npm run build                # Production build
npm run build -- --configuration qa    # QA build

# Testing
npm test                     # Run unit tests (Vitest)
npm run test:coverage        # Run with coverage (thresholds: 85% statements, 75% branches)

# Linting & Formatting
npm run lint                 # ESLint (Angular ESLint)
npm run lint:fix             # Auto-fix lint issues
npm run format               # Prettier auto-format
npm run format:check         # Prettier check (CI)

# Analysis
npm run analyze              # Source map explorer (check bundle sizes)
```

---

## Architecture

### Tech Stack

- **Angular 22** with standalone components (no NgModules)
- **TypeScript 6** with strict mode + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- **Vitest** for unit testing (not Karma/Jasmine)
- **ESLint** + **Prettier** + **Husky** + **lint-staged** for code quality
- **RxJS 7.8** for reactive patterns
- **Angular Signals** for component state

### Folder Structure

```
src/app/
  core/                          # App-wide singletons (depends on nothing in shared/)
    interceptors/                # HTTP interceptors (auth, error, security-headers)
    error-handler/               # Global ErrorHandler
  shared/                        # Reusable across features (depends on core/)
    components/                  # Reusable UI components
    models/                      # Shared domain models and API types
    services/                    # Cross-cutting services (storage, logging, nav-preferences)
    utils/                       # Pure utility functions
    constants/                   # Centralized constants (routes)
  features/                      # Domain-specific feature modules
    auth/                        # Authentication (login, register, guard)
      guards/
      models/
      pages/
      services/
    timeline/                    # Timeline events
      components/
      models/
      pages/
      services/
    library/                     # User library (tracked items, wish list)
      components/
      models/
      pages/
      services/
    catalog/                     # Admin catalog management
      components/
      models/
      pages/
      services/
    landing/                     # Landing/home page
      pages/
    account/                     # User account settings
      pages/
```

### Dependency Direction

```
core/  <--  shared/  <--  features/
```

- `core/` depends on nothing else (only Angular/RxJS)
- `shared/` depends on `core/` and Angular/RxJS
- `features/` depends on `shared/`, `core/`, and other features only through shared abstractions
- **Never** import from a feature into another feature directly (use shared abstractions)
- **Never** import from `shared/` into `core/`

### Domain Overview (API contracts)

- **Source materials, characters, species, vehicles, timeline events**: each has a catalog service under `features/<name>/services/` backed by a `SignalCache`. Mutations `invalidate()` their own cache and the global `catalog-invalidator` service (`features/catalog/services/catalog-invalidator.service.ts`) busts related caches across features.
- **Galaxy hierarchy** — the five admin-managed levels `Region` → `Subregion` → `PlanetSystem` → `Planet` → `PlanetLocation` are all driven by `GalaxyService` (`features/catalog/services/galaxy.service.ts`). It keeps one `SignalCache` per level plus a shared aggregated `planets` list. The planets cache fetches `GET /api/planet-systems` and then fires one `GET /api/planet-systems/{id}/planets` per returned system — only when the systems array is non-empty. `fetchAll()` fetches regions + subregions + systems + planets; the Galaxy catalog tab (`components/galaxy-catalog`) assembles a nested read-only/admin tree from the flat per-level lists.
- **Character/species planet links**: birth/home planets are `Planet` ids; the dropdown options come from the aggregated `planets` list resolved by name.
- **Timeline event locations** are typed, any-level references — never raw strings: `LocationReference { locationHierarchyType, locationId }` (`shared/models/location-reference.ts`), where `locationHierarchyType` is `Region | Subregion | PlanetSystem | Planet | PlanetLocation` (`shared/models/location-hierarchy-type.ts`, API codes 1..5). The event-edit dialogs build their picker from galaxy data via `TimelineEventCatalogPresenter`'s `galaxyNodes` tree and encode selections as `"<typeCode>:<id>"` (e.g. Planet 12 → `'4:12'`).

---

## Conventions

### Components

- **Always use `ChangeDetectionStrategy.OnPush`** — every component in the project does this
- Use standalone components (no NgModules)
- Use `input()`, `output()`, `model()` for component communication (not `@Input()`/`@Output()` decorators)
- Name files with kebab-case: `timeline-event-item.ts`, `site-header.html`
- Co-locate `.ts`, `.html`, `.scss`, `.spec.ts` in the same folder
- Route-level components go in `pages/`, reusable pieces go in `components/`

### Services

- Use `@Injectable({ providedIn: 'root' })` for singletons
- Feature-scoped services go in `features/<name>/services/`
- Cross-cutting services go in `shared/services/` or `core/services/`
- **Always provide explicit return types** on all public and private methods
- Use pure functions for mapping/transformation — extract to `*.mapper.ts` files

### Models & DTOs

- Use `readonly` on all interface properties and `readonly` arrays
- Separate wire-format DTOs from domain models with dedicated mapper files
- Use `as const` for constant objects and tuples
- Replace magic strings with enums or const objects in `shared/constants/`
- API models in `shared/models/api-*.ts` represent the domain layer (not raw wire format)

### RxJS & Signals

- **Signals** for component UI state (signals, computed, effects)
- **Observables** for HTTP streams, SSE, and async data flows
- **Never use nested subscribes** — use `switchMap`, `mergeMap`, etc.
- **Always use `takeUntilDestroyed(this.destroyRef)`** for subscriptions in components/presenters
- Use `tap()` for side effects (cache invalidation, signal setting)
- Use `switchMap` for mutation→reload flows
- `SignalCache<T>` is the standard caching primitive — use it for all HTTP-cached data

### Testing

- **Vitest** — not Karma/Jasmine. Run with `npm test`
- Co-locate specs next to source files: `foo.ts` → `foo.spec.ts`
- Use `HttpTestingController` for HTTP tests — always call `httpMock.verify()` in `afterEach`
- Assert URL, HTTP method, and request body for all requests
- When a component's initial fetch reaches `GalaxyService`, the planets aggregate fires `GET /api/planet-systems` (and, when systems are returned, one `GET /api/planet-systems/{id}/planets` per system). Component specs flush the aggregate with `[]` to avoid the follow-ups (see the `flushInitialFetch` helpers in the character/species catalog specs) — a non-empty aggregate leaves per-system requests open and `httpMock.verify()` fails.
- Test public behavior, not private methods
- Use `ComponentFixture` + `fixture.nativeElement` for DOM queries (ComponentHarness adoption in progress)
- Use nested `describe` blocks organized by behavior/feature

### Accessibility

- Add `aria-label` to all interactive elements without visible text labels
- Wrap app content in `<main id="main-content">` landmark
- Include a "Skip to content" link as the first focusable element
- Use `role="dialog"` and `aria-modal="true"` on all modals
- Implement focus trapping in all dialogs (`cdkTrapFocus`)
- Use `@let` bindings to avoid redundant signal reads in templates

### Error Handling

- Use typed error models per feature (e.g., `TimelineError`, `CatalogError`, `AuthError`)
- Define companion const objects alongside error code types (e.g., `CatalogErrorCode.EntityInUse`)
- Use centralized error handler functions (e.g., `catalogErrorHandler()`)
- Guard `HttpErrorResponse` casts with `instanceof` before accessing properties

### Documentation

- Add `@fileoverview` JSDoc to every file
- Document public methods with `@param`, `@returns`, `@throws`
- Add `@see` cross-references between related modules
- Comment non-obvious architectural decisions (race conditions, `untracked()` usage, etc.)

### Build & Deployment

- All routes must use `loadComponent` with dynamic `import()` for lazy loading
- Production budgets: 500kB warning, 1MB error (initial), 4kB/8kB (component styles)
- Use `source-map-explorer` (`npm run analyze`) to audit bundle sizes
- Three environments: `development`, `qa`, `production` — use file replacements
- `@angular/forms` is a dependency — verify it is used before removing

---

## Common Patterns

### Feature Component Structure

```typescript
// features/<name>/components/<component-name>/<component-name>.ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-<component-name>',
  templateUrl: './<component-name>.html',
  styleUrl: './<component-name>.scss',
})
export class ComponentName {
  // inputs and outputs only for presentational components
  readonly data = input.required<DataType>();
  readonly action = output<Payload>();
}
```

### Service with SignalCache

```typescript
// features/<name>/services/<name>.service.ts
@Injectable({ providedIn: 'root' })
export class NameService {
  private readonly http = inject(HttpClient);
  // SignalCache(fetchFn, errorHandler?, ttlMs?) — positional, not an options object
  private readonly cache = new SignalCache<readonly Item[]>(
    () => this.http.get<readonly ItemDto[]>(URL).pipe(map((items) => items.map(mapItem))),
    (err) => (err instanceof HttpErrorResponse ? readProblemDetail(err, 'Failed to load items') : 'Failed to load items'),
    CACHE_TTL_MS,
  );

  readonly items = this.cache.data;      // Signal<readonly Item[] | null>
  readonly loading = this.cache.loading; // Signal<boolean>
  readonly error = this.cache.error;     // Signal<string | null>

  fetchItems(): void {
    this.cache.fetch(); // no-op when data is already cached or a fetch is in flight
  }

  invalidate(): void {
    this.cache.invalidate(); // clears data and re-fetches immediately (use after mutations)
  }
}
```

> **Testing gotcha:** `SignalCache.fetch()` short-circuits when `data` is non-null, so a spec that reloads a list after a mutation must call the service's `invalidate()` (which clears the cached value first) — a bare `fetch()` on an already-cached `[]` fires no request and `httpMock.expectOne` fails with "found none". See the `loadSpecies`/`loadVehicles` helpers in the catalog component specs.

### HTTP Error Handling

```typescript
// catchError pattern
.pipe(
  catchError((err) => readProblemDetail(err as HttpErrorResponse, fallbackMessage)),
)
// Prefer instanceof guard:
.pipe(
  catchError((err) => {
    if (err instanceof HttpErrorResponse) {
      return readProblemDetail(err, fallbackMessage);
    }
    return throwError(() => new FeatureError(fallbackMessage, FeatureErrorCode.NetworkError));
  }),
)
```

---

## Key Files Reference

| Purpose | Path |
|---------|------|
| App bootstrap & providers | `src/app/app.config.ts` |
| Route definitions | `src/app/app.routes.ts` |
| Environment model | `src/environments/environment.model.ts` |
| Shared components | `src/app/shared/components/` |
| Shared utilities | `src/app/shared/utils/` |
| Shared models | `src/app/shared/models/` |
| Core interceptors | `src/app/core/interceptors/` |
| Signal cache utility | `src/app/shared/utils/signal-cache.ts` |
| Error detail parser | `src/app/shared/utils/problem-detail.ts` |
| Route constants | `src/app/shared/constants/routes.constants.ts` |
| Galaxy CRUD service | `src/app/features/catalog/services/galaxy.service.ts` |
| Galaxy catalog tab | `src/app/features/catalog/components/galaxy-catalog/galaxy-catalog.ts` |
| Location reference model | `src/app/shared/models/location-reference.ts` |
| Hierarchy type + API codes | `src/app/shared/models/location-hierarchy-type.ts` |
| Cross-catalog cache busting | `src/app/features/catalog/services/catalog-invalidator.service.ts` |
| Catalog error handler | `src/app/features/catalog/services/catalog-error-handler.ts` |
| Auth guard | `src/app/features/auth/guards/auth.guard.ts` |

---

## Things to Avoid

1. **Don't** import from one feature into another — use shared abstractions
2. **Don't** use `Default` change detection — always `OnPush`
3. **Don't** use nested `.subscribe()` — use RxJS operators
4. **Don't** use `as any` — use proper type narrowing or `as unknown as T` with guards
5. **Don't** use magic strings — use const objects or enums
6. **Don't** put logic in templates — use computed signals or helper methods
7. **Don't** forget `takeUntilDestroyed(this.destroyRef)` for subscriptions in components
8. **Don't** forget `httpMock.verify()` in test `afterEach` blocks
9. **Don't** use `WritableSignal` in public APIs — expose `ReadonlySignal` via `.asReadonly()`
10. **Don't** skip `@fileoverview` JSDoc on new files
