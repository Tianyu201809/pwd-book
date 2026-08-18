# GitHub CI/CD Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On push of tag `v*`, build Windows (NSIS→zip), Linux (AppImage), and macOS (DMG x64/arm64) installers and publish them to a GitHub Release.

**Architecture:** Three parallel native GitHub Actions jobs (`windows-latest`, `ubuntu-latest`, `macos-latest`) each run the existing `electron-builder` scripts; a final `publish-release` job downloads artifacts and creates/updates the Release with `softprops/action-gh-release`. Version is derived from the tag (strip leading `v`) and written into `package.json` in CI only (no git commit).

**Tech Stack:** GitHub Actions, Node 20, npm, electron-builder 26, softprops/action-gh-release, PowerShell `Compress-Archive` (Windows zip step)

**Spec:** `docs/superpowers/specs/2026-07-17-github-cicd-release-design.md`

---

## File structure

| File | Responsibility |
|---|---|
| `package.json` | Add `build.linux` (AppImage x64) and `predist:linux` / `dist:linux` scripts |
| `.github/workflows/release.yml` | Tag trigger, three build jobs, publish job |
| `docs/code-map/overview.md` | Document Linux + CI release assets |
| `README.md` | Brief note on tag-triggered release and `dist:linux` |

No new application runtime code. No new npm dependencies.

---

### Task 1: Add Linux packaging config to `package.json`

**Files:**
- Modify: `package.json` (scripts + `build.linux`)

- [ ] **Step 1: Add Linux npm scripts**

In `package.json` → `scripts`, after the existing `predist:mac:dir` / `dist:mac:dir` entries, add:

```json
"predist:linux": "npm run icons",
"dist:linux": "npm run build && electron-builder --linux"
```

Keep existing win/mac scripts unchanged.

- [ ] **Step 2: Add `build.linux` block**

In `package.json` → `build`, after the existing `dmg` block (and before the closing of `build`), add:

```json
"linux": {
  "target": [
    {
      "target": "AppImage",
      "arch": ["x64"]
    }
  ],
  "category": "Utility",
  "artifactName": "${productName}-${version}.${ext}"
}
```

Do not change `win`, `nsis`, `mac`, or `dmg`.

- [ ] **Step 3: Validate JSON**

Run (from repo root):

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('ok', require('./package.json').scripts['dist:linux'], require('./package.json').build.linux)"
```

Expected: prints `ok` plus `npm run build && electron-builder --linux` and the linux config object.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "feat: add Linux AppImage packaging scripts"
```

---

### Task 2: Create `.github/workflows/release.yml`

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create the workflow directory if needed**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Write the full workflow file**

Create `.github/workflows/release.yml` with **exactly** this content:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

env:
  NODE_VERSION: '20'
  CSC_IDENTITY_AUTO_DISCOVERY: 'false'

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - name: Resolve version from tag
        shell: bash
        run: |
          TAG="${GITHUB_REF_NAME}"
          VERSION="${TAG#v}"
          echo "VERSION=${VERSION}" >> "$GITHUB_ENV"
          echo "Resolved VERSION=${VERSION} from tag ${TAG}"

      - name: Install dependencies
        run: npm ci

      - name: Set package.json version
        shell: bash
        run: npm version "${VERSION}" --no-git-tag-version --allow-same-version

      - name: Build Windows NSIS installer
        run: npm run dist:win

      - name: Zip Setup.exe
        shell: pwsh
        run: |
          $exe = "release/PwdBook-${env:VERSION}-Setup.exe"
          $zip = "release/PwdBook-${env:VERSION}-Setup.zip"
          if (-not (Test-Path -LiteralPath $exe)) {
            throw "Missing NSIS installer: $exe"
          }
          if (Test-Path -LiteralPath $zip) {
            Remove-Item -LiteralPath $zip -Force
          }
          Compress-Archive -LiteralPath $exe -DestinationPath $zip
          Write-Host "Created $zip"

      - name: Upload Windows artifact
        uses: actions/upload-artifact@v4
        with:
          name: windows
          path: release/PwdBook-*-Setup.zip
          if-no-files-found: error

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - name: Install AppImage dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y libfuse2

      - name: Resolve version from tag
        shell: bash
        run: |
          TAG="${GITHUB_REF_NAME}"
          VERSION="${TAG#v}"
          echo "VERSION=${VERSION}" >> "$GITHUB_ENV"
          echo "Resolved VERSION=${VERSION} from tag ${TAG}"

      - name: Install dependencies
        run: npm ci

      - name: Set package.json version
        run: npm version "${VERSION}" --no-git-tag-version --allow-same-version

      - name: Build Linux AppImage
        env:
          APPIMAGE_EXTRACT_AND_RUN: '1'
        run: npm run dist:linux

      - name: Upload Linux artifact
        uses: actions/upload-artifact@v4
        with:
          name: linux
          path: release/PwdBook-*.AppImage
          if-no-files-found: error

  build-macos:
    runs-on: macos-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - name: Resolve version from tag
        shell: bash
        run: |
          TAG="${GITHUB_REF_NAME}"
          VERSION="${TAG#v}"
          echo "VERSION=${VERSION}" >> "$GITHUB_ENV"
          echo "Resolved VERSION=${VERSION} from tag ${TAG}"

      - name: Install dependencies
        run: npm ci

      - name: Set package.json version
        run: npm version "${VERSION}" --no-git-tag-version --allow-same-version

      - name: Build macOS DMGs
        run: npm run dist:mac

      - name: Upload macOS artifacts
        uses: actions/upload-artifact@v4
        with:
          name: macos
          path: |
            release/PwdBook-*-x64.dmg
            release/PwdBook-*-arm64.dmg
          if-no-files-found: error

  publish-release:
    needs: [build-windows, build-linux, build-macos]
    runs-on: ubuntu-latest
    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts
          merge-multiple: true

      - name: List artifacts
        run: ls -la artifacts

      - name: Create or update GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.ref_name }}
          name: ${{ github.ref_name }}
          draft: false
          prerelease: ${{ contains(github.ref_name, '-') }}
          generate_release_notes: true
          files: artifacts/*
          fail_on_unmatched_files: true
```

- [ ] **Step 3: Sanity-check YAML locally (optional but recommended)**

If Python is available:

```bash
python -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml', encoding='utf-8')); print('yaml ok')"
```

Expected: `yaml ok`. If PyYAML is missing, skip this step; GitHub will validate on push.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add tag-triggered multi-platform release workflow"
```

---

### Task 3: Update packaging docs

**Files:**
- Modify: `docs/code-map/overview.md` (安装包 section)
- Modify: `README.md` (brief packaging / CI mentions)

- [ ] **Step 1: Update `docs/code-map/overview.md` 安装包 table**

Replace the "### 安装包（electron-builder）" section (table + following paragraph) with:

```markdown
### 安装包（electron-builder）

| 命令 | 平台 | 产物 |
|------|------|------|
| `npm run dist:win` | Windows x64 | `release/PwdBook-{version}-Setup.exe`（NSIS） |
| `npm run dist:win:dir` | Windows x64 | `release/win-unpacked/` |
| `npm run dist:mac` | macOS x64 + arm64 | `release/PwdBook-{version}-{arch}.dmg`（v1.10.0） |
| `npm run dist:mac:dir` | macOS | `release/mac/` 或 `release/mac-arm64/` 下的 `.app` |
| `npm run dist:linux` | Linux x64 | `release/PwdBook-{version}.AppImage` |

macOS / Windows 当前未配置代码签名（Windows `signAndEditExecutable: false`）；分发时目标机器可能提示 SmartScreen / Gatekeeper。

### GitHub Release CI

推送匹配 `v*` 的 tag（如 `v1.27.0`）会触发 `.github/workflows/release.yml`：并行构建 Windows / Linux / macOS，并创建或更新对应 GitHub Release。Release 资产为：

- Windows：`PwdBook-{version}-Setup.zip`（内含 NSIS `Setup.exe`）
- Linux：`PwdBook-{version}.AppImage`
- macOS：`PwdBook-{version}-x64.dmg`、`PwdBook-{version}-arm64.dmg`

旧标签名 `release-v*` **不会**触发该 workflow。
```

- [ ] **Step 2: Update README packaging lines**

In `README.md`:

1. In the overview paragraph that says 官方打包支持 **Windows**（NSIS）与 **macOS**（DMG，x64 / arm64）, change to: 官方打包支持 **Windows**（NSIS）、**macOS**（DMG，x64 / arm64）与 **Linux**（AppImage）；推送 `v*` tag 可经 GitHub Actions 发布 Release。

2. In the table row `| 官方打包 | **Windows**（NSIS）· **macOS**（DMG，v1.10.0 起） |`, change to: `| 官方打包 | **Windows**（NSIS）· **macOS**（DMG）· **Linux**（AppImage）；CI：tag \`v*\` → GitHub Release |`

3. In the system requirements bullet that says Linux 未在 `electron-builder` 中配置, change to mention Linux AppImage via `npm run dist:linux` / CI.

4. In the scripts table near `dist:mac:dir`, add a row:

```markdown
| `npm run dist:linux` | 构建并生成 Linux x64 AppImage（输出 `release/`） |
```

Keep wording consistent with surrounding Chinese style; do not rewrite unrelated README sections.

- [ ] **Step 3: Commit**

```bash
git add docs/code-map/overview.md README.md
git commit -m "docs: document Linux AppImage and tag release CI"
```

---

### Task 4: End-to-end verification on GitHub

**Files:** none (remote Actions run)

Prerequisites: changes from Tasks 1–3 are pushed to the remote default branch (`master` / `main`) so the workflow file exists on the repo GitHub sees.

- [ ] **Step 1: Push commits to origin**

```bash
git push origin HEAD
```

Expected: push succeeds; `.github/workflows/release.yml` is on the remote.

- [ ] **Step 2: Create and push a disposable test tag**

```bash
git tag v0.0.0-ci-test
git push origin v0.0.0-ci-test
```

Expected: GitHub Actions run named **Release** starts for that tag.

- [ ] **Step 3: Wait for all jobs**

Monitor the Actions run until `build-windows`, `build-linux`, `build-macos`, and `publish-release` are green.

If a job fails, open its log, fix the root cause in the corresponding Task 1–2 files, commit, push, delete and recreate the test tag (or push an updated tag after deleting the remote tag), and re-run.

```bash
# only if re-test needed after fixes:
git push origin :refs/tags/v0.0.0-ci-test
git tag -d v0.0.0-ci-test
git tag v0.0.0-ci-test
git push origin v0.0.0-ci-test
```

- [ ] **Step 4: Verify Release assets**

On the GitHub Release for `v0.0.0-ci-test`, confirm these four assets exist:

1. `PwdBook-0.0.0-ci-test-Setup.zip`
2. `PwdBook-0.0.0-ci-test.AppImage`
3. `PwdBook-0.0.0-ci-test-x64.dmg`
4. `PwdBook-0.0.0-ci-test-arm64.dmg`

Confirm the Release is marked **Pre-release** (because the tag contains `-`).

Download the Windows zip and confirm it contains `PwdBook-0.0.0-ci-test-Setup.exe`.

- [ ] **Step 5: Clean up the test tag/release**

Delete the GitHub Release for `v0.0.0-ci-test` in the UI (or `gh release delete v0.0.0-ci-test --yes`), then:

```bash
git push origin :refs/tags/v0.0.0-ci-test
git tag -d v0.0.0-ci-test
```

- [ ] **Step 6: Final commit only if fixes were needed**

If Step 3 required code fixes, ensure those fixes are committed with clear messages (e.g. `fix(ci): ...`). If everything passed with no extra changes, no further commit.

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| Trigger on `v*` | Task 2 workflow `on.push.tags` |
| Windows NSIS then zip; Release gets zip only | Task 2 `build-windows` zip + upload zip |
| Linux AppImage x64 | Task 1 `build.linux` + Task 2 `build-linux` |
| macOS DMG x64 + arm64 | Task 2 `build-macos` / existing `dist:mac` |
| Auto GitHub Release | Task 2 `publish-release` |
| Version from tag, no git commit | Task 2 `npm version --no-git-tag-version` |
| Prerelease when tag has `-` | Task 2 `prerelease: contains(..., '-')` |
| No code signing | Task 2 `CSC_IDENTITY_AUTO_DISCOVERY=false` + existing package.json |
| Docs touchpoints | Task 3 |
| E2E verification | Task 4 |

## Out of scope (do not implement)

- PR/push lint-test CI
- Code signing / notarization
- CHANGELOG auto-update / version bump commits on default branch
- Linux arm64
