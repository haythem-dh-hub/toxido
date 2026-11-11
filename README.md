# TOXIDO

Luxury e-commerce platform for fragrance and gentleman's accessories, built with Next.js App Router and TypeScript.

## Status

Phase 1 is complete: project foundation, strict TypeScript configuration, Tailwind setup, module directories, environment template, metadata baseline, and framework-independent commerce contracts are in place.

## Local development

```bash
npm install
npm run dev
```

Use `npm run lint` and `npm run typecheck` before changes. Copy `.env.example` to `.env.local` only when introducing the corresponding integration.

## Architecture

- `src/app`: routes, layouts, metadata, and route-level composition.
- `src/components/ui`: reusable visual primitives.
- `src/components/{layout,home,product,cart}`: presentational assemblies.
- `src/features`: feature-specific state and use cases.
- `src/services`: persistence and third-party integration boundaries.
- `src/lib`: framework and shared utilities.
- `src/types`: stable domain and API contracts.

Features must not call Prisma, Cloudinary, payment, or future AI/WhatsApp SDKs directly; use a service interface so implementations stay replaceable.
