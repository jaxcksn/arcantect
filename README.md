<p align="center">
  <img src="./docs/arcantect_banner.png" alt="Arcantect" width="100%">
</p>

# Arcantect

Arcantect is an interactive cloud architecture puzzle game. It turns system design practice into a tactile diagramming challenge: read a story-style brief, place infrastructure "runes" on a canvas, connect the flows, and see whether the architecture holds up.

The project blends product design, frontend interaction, and architecture education. Instead of asking players to memorize cloud services in isolation, Arcantect asks them to reason about how systems fit together: ingress, caching, authentication, data storage, asynchronous work, third-party integrations, and security boundaries.

## Project Highlights

- **Canvas-first interaction**: players drag, place, and connect infrastructure components directly.
- **Live architecture feedback**: requirements and violations update as the graph changes.
- **Scenario-driven learning**: each puzzle frames the architecture as a concrete product need.
- **Directed flow modeling**: edge direction matters, so diagrams capture how requests, data, and events move.
- **Rule-based scoring**: puzzle rubrics check architectural intent rather than exact vendor configuration.
- **Persistent sessions**: progress is saved locally so a puzzle can be revisited after refresh.

## Running Locally

```bash
pnpm install
pnpm --filter @arcantect/client dev
```

Useful checks:

```bash
pnpm --filter @arcantect/client build
pnpm --filter @arcantect/scorer test
pnpm --filter @arcantect/datalog test
```
