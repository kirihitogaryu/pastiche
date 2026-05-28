# Local Library Sidecar

Pastiche stores the local archive in a sidecar directory owned by the server runtime. Set
`PASTICHE_LIBRARY_DIR` to choose the archive location; when it is unset, development uses
`.pastiche/` at the project root.

The sidecar contains:

```text
workspace.sqlite
originals/
thumbnails/
imports/
lazy-downloads/
palettes-cache/
exports/
```

SQLite owns metadata: assets, folders, source hashes, recent destinations, import failures,
and queued lazy downloads. The filesystem owns image bytes and generated artifacts. URL-reference
assets can exist without local image bytes; downloaded assets write originals under `originals/`.

The browser extension talks to Pastiche through `GET /api/status` and `POST /api/import` on the
local HTTP server. Today those endpoints are SvelteKit server routes running on the Node adapter.
If Pastiche later moves to Tauri, the same HTTP contract should move behind a lightweight Rust
server while the extension continues to call `localhost:{port}`.
