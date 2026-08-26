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
  private readonly cache = new SignalCache<Item[]>({
    fetch: () => this.http.get<readonly ItemDto[]>(URL).pipe(map(items => items.map(mapItem))),
    ttlMs: CACHE_TTL_MS,
  });

  readonly items = this.cache.data.asReadonly();
  readonly loading = this.cache.loading.asReadonly();
  readonly error = this.cache.error.asReadonly();
}
```

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
