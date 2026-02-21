# Security Policy

## Reporting a vulnerability
If you find a security issue, please **do not** open a public issue with sensitive details.
Instead, report it privately to the repository owner.

## What not to commit
- `.env` files (use `.env.example`)
- API keys, tokens, passwords, payment-provider secrets
- Database files/dumps containing real or personal data

## Basic secure defaults
- Use a strong `JWT_SECRET` in any non-local environment.
- Restrict CORS origins in production.
- Prefer least-privilege database credentials.
