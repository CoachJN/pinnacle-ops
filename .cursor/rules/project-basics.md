# Project basics

- This repo is a production-oriented work order management platform.
- Primary stack: Next.js App Router, TypeScript, Tailwind CSS, Firebase Auth/Admin, API routes, role-based access.
- Prefer server-first architecture and clean separation between UI, business logic, validation, and data access.
- Reuse existing patterns before introducing new abstractions.
- Keep changes minimal and easy to review.

# Commands

- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`

# Delivery rules

- Do not leave placeholder TODO implementations unless explicitly requested.
- When changing business logic, update or add tests.
- Do not silently break build, lint, or types.
- Summarize changed files, assumptions, and risks after each task.