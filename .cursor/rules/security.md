# Security

- Treat all client input as untrusted.
- Enforce auth and permissions server-side.
- Never expose secrets to the client.
- Avoid logging sensitive user, customer, or financial data.
- Prefer explicit allowlists over implicit trust.
- Flag any destructive auth, migration, or permission change before applying it.