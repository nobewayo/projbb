# Client Package (Planned)

This package will host the Bitby web client implemented in TypeScript with WebGL/Pixi rendering. Follow Master Spec v3.7 §§2–7, 16, and Appendix A for deterministic grid rendering, movement handling, UI chrome, and accessibility rules.

## Upcoming Tasks
- Implement diamond grid renderer anchored top-right with deterministic layout.
- Add optimistic movement + server validation hooks per transport spec.
- Build right panel, bottom dock, and context menus that respect chrome-only theming.
- Integrate asset loading, avatar paper-doll compositing, and chat bubbles.
