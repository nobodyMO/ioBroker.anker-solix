# Publishing checklist (npm + ioBroker catalog)

## Status

| Step | Status |
|------|--------|
| GitHub tag `v0.9.5` | Created |
| CI deploy workflow | Enabled (needs npm trusted publisher) |
| Catalog PR (latest) | https://github.com/ioBroker/ioBroker.repositories/pull/6014 |
| npm package `iobroker.anker-solix` | **Pending** — publish failed: npm auth / trusted publishing |

## 1. Publish to npm (required for catalog rules)

### Option A — Trusted publishing (recommended)

1. Log in at [npmjs.com](https://www.npmjs.com/) as user **MatthiasUlrich1** (package owner).
2. Open package settings (after first publish) or account → **Access Tokens** → **Trusted Publishers**.
3. Add trusted publisher:
   - **Provider:** GitHub Actions
   - **Repository:** `MatthiasUlrich1/ioBroker.anker-solix`
   - **Workflow:** `test-and-release.yml`
   - **Environment:** (optional, leave empty if none)
4. Re-run failed workflow or push a new tag:

   ```bash
   git tag -d v0.9.5
   git push origin :refs/tags/v0.9.5
   git tag v0.9.5
   git push origin v0.9.5
   ```

   Or bump to `v0.9.6` and tag that.

Docs: https://docs.npmjs.com/trusted-publishers

### Option B — Manual publish (once)

On your PC (logged in with `npm login`):

```bash
cd path/to/ioBroker.anker-solix
npm run build
npm publish --access public
```

Verify: `npm view iobroker.anker-solix version`

## 2. Add ioBroker as npm owner (required for official list)

After the package exists on npm:

1. npm → package **iobroker.anker-solix** → **Settings** → invite user/org **`iobroker`** as maintainer  
   **or** ask in [ioBroker forum](https://forum.iobroker.net/) to add the org as owner.

See: https://github.com/ioBroker/ioBroker.repositories#add-owner-to-packet

## 3. ioBroker catalog (latest)

PR prepared: **https://github.com/ioBroker/ioBroker.repositories/pull/6014**

After npm is live, maintainers usually merge. Then on any ioBroker host:

```bash
iobroker update available
iobroker install anker-solix
```

Alternative without waiting for PR merge: `iobroker url https://github.com/MatthiasUlrich1/ioBroker.anker-solix`

## 4. Stable repository (later)

Requirements: adapter in **latest**, forum testing thread, then PR to `sources-dist-stable.json` with `npm run addToStable` in [ioBroker.repositories](https://github.com/ioBroker/ioBroker.repositories).

## 5. Adapter check

https://adaptercheck.iobroker.in/?url=https://github.com/MatthiasUlrich1/ioBroker.anker-solix

Fix any reported issues before stable promotion.
