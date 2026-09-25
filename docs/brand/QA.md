# Identity verification — 2026-09-25

Applied on fresh `main` at `f405576`, including the scorecard update.

- `npm run typecheck`: passed.
- `npm test`: 124 tests passed, including identity asset delivery and metadata.
- `npm run smoke:pages`: all representative routes returned their expected statuses.
- `python scripts/brand/verify.py`: all SVGs parsed; image dimensions, opacity,
  maskable and avatar safe circles, X overlap region, and ICO sizes passed.
- Browser: Hebrew desktop light/dark and 390 px mobile dark; English 390 px mobile
  light. Header icon loaded; document width stayed within the mobile viewport.
- Theme buttons worked, scorecard navigation worked, and the browser reported no
  console or page errors on the inspected home and scorecard pages.
- Reviewed the identity sheet at actual 16/32/48 px favicon sizes and inspected
  the Hebrew lettering and circular avatar crop.

Browser captures: [desktop light](site-desktop-light.png),
[desktop dark](site-desktop-dark.png), [Hebrew mobile dark](site-mobile-dark.png),
[English mobile light](site-mobile-light-en.png).

The site is locally integrated. No deployment or social-account upload was made.
