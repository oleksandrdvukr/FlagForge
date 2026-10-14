# ADR-0007: Serve the SPA from the NestJS process

- **Status:** Accepted
- **Date:** 2026-10-14
- **Related:** SEC-02, ADR-0001

## Context

The dashboard is a React SPA built with Vite. It authenticates with an HTTP-only `SameSite=Lax` cookie (SEC-02).

## Options

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **A. NestJS serves the built SPA (`@nestjs/serve-static`)** | One image, same origin → no CORS, cookies just work | Static files served by Node instead of a dedicated web server |
| B. Separate nginx container | Efficient static serving | Second container, proxy config |
| C. CDN hosting | Global edge delivery | Cross-origin cookies, contradicts self-hosting |

## Decision

**Option A.** In development the Vite dev server proxies `/api` to NestJS; in production NestJS serves `apps/web/dist`.

## Consequences

- ✅ One Docker image, one port.
- ✅ No CORS configuration; cookie auth works out of the box.
- ⚠️ Static asset throughput is bounded by Node; irrelevant for an admin dashboard.
