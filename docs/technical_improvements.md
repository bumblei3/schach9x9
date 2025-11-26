# Technical Improvements for Schach9x9

- **Modularize code**: Split `main.js` into separate modules (e.g., `gameEngine.js`, `ui.js`, `utils.js`) and use ES modules (`import`/`export`).
- **Linting & Formatting**: Add ESLint and Prettier configurations; run them on every commit.
- **Unit Tests**: Set up Jest and write tests for piece movement, capture logic, and special pieces (e.g., Chancellor).
- **Performance Profiling**: Measure FPS / render time, minimise DOM updates, and debounce UI events.
- **Asset Optimisation**: Pre‑load sound files, lazy‑load images, and compress assets.
- **Documentation**: Add JSDoc comments to all public functions and generate HTML docs.
- **CI Workflow**: Configure a GitHub Actions workflow to run linting and tests on push.
- **Type Safety (optional)**: Consider migrating to TypeScript for better developer experience.
