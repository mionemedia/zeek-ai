# Tasks — Category Panel Normalization

> Reminder: As tasks are completed or re-scoped, update `/.agent-os/product/roadmap.md` accordingly.

Parent Task 1 — Normalize category selection and render panel

- [x] 1.1 Normalize comparison keys (trim+lowercase) for selected category vs. `AGENTS_CATALOG[i].category`
- [x] 1.2 Ensure custom dropdown updates `aria-selected` and sets hidden select value
- [x] 1.3 Call a single `renderCategoryPanel(selected)` on selection
- [x] 1.4 Hide panel for "All"; clear contents
- [x] 1.5 Populate rows with themed icon + name + description; first row no top border

Parent Task 2 — Selection feedback (toast)

- [x] 2.1 Implement `notify(text)` utility (non-blocking, 2–3s auto-dismiss)
- [x] 2.2 Show "N agents in <Category>" when category changes (except All)

Parent Task 3 — Accessibility & focus

- [x] 3.2 Maintain focus on toggle after selection; Esc closes menu

Parent Task 4 — Theme consistency & cleanup

- [x] 4.1 Ensure hover/selected backgrounds use `var(--icon-accent)`-based color-mix
- [x] 4.2 Remove any leftover icon filters that conflict with theme

Parent Task 5 — Tailwind CSS integration (vanilla UI, no React)

> Proceeding with Option B (no Vite, no Docker). Integrate Tailwind CLI into the current `index.html`/`style.css`/`script.js` stack. Update `/.agent-os/product/roadmap.md` as items complete.

- [x] 5.1 Add Tailwind CLI dev deps and config (`tailwind.config.js`, `postcss.config.js`)
- [x] 5.3 Map existing tokens to Tailwind/shadcn-like CSS vars in a base layer (e.g., `--primary: var(--icon-accent)`; background/foreground from current tokens)
- [x] 5.4 Include compiled `dist/styles.css` in `index.html` (keep `style.css` during migration)
- [x] 5.5 Incrementally replace common utility styles with Tailwind classes in a few key views (nav, Agents Catalog, Settings Appearance)
- [x] 5.6 Verify Light/Dark/System parity using `html[data-theme]`
- [x] 5.7 Update docs to note Tailwind usage (and that shadcn will come with React/Next.js later)

Parent Task 6 — Chat window layout parity (post‑Tailwind)

- [ ] 6.1 Audit Conversations view elements (header, list card, composer bar, actions) for spacing/position shifts
- [ ] 6.2 Apply minimal, scoped fixes (utilities or token mapping) to restore original layout
- [ ] 6.3 Verify Light/Dark/System parity and hover/focus states
- [ ] 6.4 Regression pass on other routes (no visual drift)
