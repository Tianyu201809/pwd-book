# GitHub CI/CD Release Design — Tag-triggered Multi-platform Packaging

**Date:** 2026-07-17  
**Status:** Approved for implementation planning  
**Scope:** Push tag `v*` → build Windows / Linux / macOS installers → publish GitHub Release

## Goals

- Pushing a git tag matching `v*` (e.g. `v1.27.0`) triggers packaging for three platforms.
- Artifacts are published to a GitHub Release for that tag.
- Windows: build NSIS `Setup.exe`, then zip it; Release attaches only the zip.
- Linux: AppImage (x64).
- macOS: DMG for x64 and arm64 (existing electron-builder config).
- No code signing or notarization in this iteration.

## Non-goals

- PR / push CI for lint or unit tests (separate effort).
- Auto-updating CHANGELOG or committing version bumps back to the default branch.
- Windows/macOS code signing or Apple notarization.
- Linux architectures other than x64 (e.g. arm64 AppImage).
- Cross-compilation (Wine / Docker) instead of native runners.

## Context

PwdBook is an Electron + Vue 3 app using `electron-builder` (`package.json` → `build`).

| Platform | Local today | CI target |
|---|---|---|
| Windows | `npm run dist:win` → NSIS `PwdBook-{version}-Setup.exe` | Same, then zip → `PwdBook-{version}-Setup.zip` |
| macOS | `npm run dist:mac` → DMG x64 + arm64 | Unchanged |
| Linux | Not configured | Add AppImage + `dist:linux` |

Existing tags like `release-v1.26.0` do **not** match the trigger `v*` (prefix). New releases should use tags such as `v1.27.0`.

## Approach

**Chosen:** Parallel matrix of native runners + a final publish job that creates/updates the GitHub Release.

Rejected alternatives:

1. **Per-job `electron-builder --publish`** — races when three jobs write one Release; awkward for the Windows zip step.
2. **Ubuntu-centric cross-compile** — fragile for Windows; macOS still needs a macOS runner.

## Architecture

```
push tag v*
    ├─ build-windows  (windows-latest)  → artifact: Setup.zip
    ├─ build-linux    (ubuntu-latest)   → artifact: AppImage
    └─ build-macos    (macos-latest)    → artifact: *.dmg (x64, arm64)
              │
              ▼ (all succeeded)
       publish-release (ubuntu-latest)
              │
              ▼
       GitHub Release for that tag + assets
```

### Trigger

```yaml
on:
  push:
    tags:
      - 'v*'
```

### Permissions

- `contents: write` on the workflow (or publish job) so Release assets can be created/updated.

### Version sync

1. Read tag from `GITHUB_REF_NAME` (e.g. `v1.27.0` or `v1.27.0-rc1`).
2. Strip a single leading `v` → version string (`1.27.0` / `1.27.0-rc1`).
3. Before packaging, set `package.json` `version` to that string **without** creating a git commit (so artifact names match the tag).
4. Do not push version changes back to the repository.

### Release asset names

| Platform | Asset on Release |
|---|---|
| Windows | `PwdBook-{version}-Setup.zip` (contains `PwdBook-{version}-Setup.exe`) |
| Linux | `PwdBook-{version}.AppImage` |
| macOS | `PwdBook-{version}-x64.dmg`, `PwdBook-{version}-arm64.dmg` |

### Prerelease detection

- If the tag (after the optional leading `v`) contains `-` (e.g. `v1.27.0-rc1`), mark the GitHub Release as prerelease.
- Otherwise mark as a normal release.
- Use `generate_release_notes: true`.
- Re-running the workflow for the same tag must update/replace assets with the same names (idempotent publish).

## Components

### 1. Workflow file

**Path:** `.github/workflows/release.yml`

| Job | Runner | Steps (summary) |
|---|---|---|
| `build-windows` | `windows-latest` | checkout → Node 20 → `npm ci` → set version → `npm run dist:win` → zip Setup.exe → `upload-artifact` |
| `build-linux` | `ubuntu-latest` | checkout → Node 20 → `npm ci` → set version → `npm run dist:linux` → `upload-artifact` |
| `build-macos` | `macos-latest` | checkout → Node 20 → `npm ci` → set version → `npm run dist:mac` → `upload-artifact` |
| `publish-release` | `ubuntu-latest` | `needs` all three builds → download artifacts → `softprops/action-gh-release` with collected files |

Dependency cache is optional for v1; prefer a simple reliable workflow over premature optimization.

### 2. `package.json` electron-builder additions

Add Linux target and npm scripts:

```json
"linux": {
  "target": [{ "target": "AppImage", "arch": ["x64"] }],
  "category": "Utility",
  "artifactName": "${productName}-${version}.${ext}"
}
```

Scripts:

- `predist:linux`: `npm run icons`
- `dist:linux`: `npm run build && electron-builder --linux`

Windows and macOS `build` blocks remain as today (`signAndEditExecutable: false`; no mac signing).

### 3. Windows zip step

After a successful NSIS build:

1. Locate `release/PwdBook-{version}-Setup.exe` (fail the job if missing).
2. Create `release/PwdBook-{version}-Setup.zip` containing that exe (zip root = the exe file, not a nested tree unless zip tooling requires a single entry).
3. Upload only the zip as the Windows release asset.

Implementation detail (plan phase): use platform-native zip (`Compress-Archive` on Windows runner, or a small Node script). Prefer one approach that is deterministic on `windows-latest`.

## Data / control flow

1. Developer tags and pushes: `git tag v1.27.0 && git push origin v1.27.0`.
2. GitHub Actions starts three build jobs in parallel.
3. Each job produces platform artifacts and uploads them to the workflow run.
4. `publish-release` waits for success, downloads artifacts, creates or updates the Release for that tag, attaches assets.
5. Users download installers from the GitHub Release page.

## Error handling

| Failure | Behavior |
|---|---|
| Any build job fails | `publish-release` does not run; no partial Release update from this workflow run |
| Setup.exe missing before zip | Windows job fails with a clear error |
| Publish API failure | Publish job fails; artifacts remain on the workflow run for debugging |
| Tag does not match `v*` | Workflow does not start |

No additional repository Secrets are required for this iteration.

## Testing / verification

1. Push a disposable tag (e.g. `v0.0.0-ci-test`).
2. Confirm all four jobs succeed.
3. Confirm Release assets: Windows zip, AppImage, two DMGs.
4. Confirm the zip contains the NSIS Setup.exe.
5. Delete the test Release and tag manually when done.

## Documentation touchpoints (implementation)

- Optionally update README / `docs/code-map/overview.md` to mention tag-triggered CI, Linux AppImage, and that Release Windows asset is zip-wrapped Setup.exe.
- Keep doc changes minimal and accurate.

## Success criteria

- Pushing `v*` produces a GitHub Release with Windows zip, Linux AppImage, and macOS x64 + arm64 DMGs.
- Windows Release asset is zip-only; NSIS installer is inside the zip.
- Version in artifact filenames matches the tag (without leading `v`).
- Unsigned builds match current local packaging policy.
- Workflow is idempotent for the same tag on re-run.
