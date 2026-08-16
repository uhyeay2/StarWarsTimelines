# StarWarsTimelines

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.7.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Connecting to the API

The application fetches catalog lookups (source materials, characters, locations, and vehicles) from the `StarWarsTimelinesApi` backend. The API base URL is configured per environment in `src/environments/`:

| Environment | File | `apiBaseUrl` |
| --- | --- | --- |
| Development (local) | `environment.ts` | `https://localhost:7089` |
| QA (hosted, placeholder) | `environment.qa.ts` | `https://qa-api.starwarstimelines.example.com` |
| Production (hosted, placeholder) | `environment.prod.ts` | `https://api.starwarstimelines.example.com` |

The development config targets the API's `https` launch profile (`https://localhost:7089`). The API's `src/StarWarsTimelines.Api/Properties/launchSettings.json` defines several local profiles; if you run the API with a different profile, update `apiBaseUrl` to match:

| Launch profile | URL |
| --- | --- |
| `http` (dotnet run) | `http://localhost:5018` |
| `https` (dotnet run) | `https://localhost:7089` |
| IIS Express | `https://localhost:44390` |

Builds select the config via `fileReplacements` in `angular.json`:

```bash
ng build                      # development values (defaults to production target)
ng build --configuration qa   # QA values
ng serve --configuration qa   # serve locally using QA values
```

To start the API locally alongside the app, run `dotnet run --project src/StarWarsTimelines.Api --launch-profile https` from the `StarWarsTimelinesApi` repository (note that a plain `dotnet run` uses the default `http` profile on port `5018`). You can also launch the IIS Express profile from Visual Studio, which serves `https://localhost:44390`. If your browser does not trust the API's `https://localhost:7089` endpoint, trust the ASP.NET Core HTTPS development certificate with `dotnet dev-certs https --trust`. The API enables CORS for the origins listed under `Cors:AllowedOrigins` in its `appsettings.json` (`http://localhost:4200` by default for the Angular dev server).

## Email verification

New accounts must verify their email address before they can log in. The API sends the verification email through [Resend](https://resend.com) SMTP (`smtp.resend.com`).

### One-time setup

1. Create a [Resend](https://resend.com) account and an API key (Resend → API Keys → Create API Key, `re_...`).
2. With no custom domain, keep the built-in `onboarding@resend.dev` sender (the default `FromAddress` in the API's `appsettings.json`). Note it can only deliver to your own account email address; to send to other recipients, add and verify a domain in Resend and update `FromAddress` to an address on it.
3. Store the API key locally so it is never committed to the repository:
   ```bash
   dotnet user-secrets set "Email:SmtpPassword" "re_your_api_key" --project src/StarWarsTimelines.Api
   ```

### Running without an API key

When `Email:SmtpPassword` is not set and the API runs in the `Development` environment, it does not attempt to send mail. Instead it logs the full outgoing email — including the verification link — to the console and to `logs/starwarstimelines-*.log`, so the verification flow still works locally with no credentials. Register with any email address and open the link printed in the log.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
