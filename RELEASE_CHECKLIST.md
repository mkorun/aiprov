# Release Checklist

Manual verification procedure to run before every `npm publish`. Not an automated test — deliberately interactive, because the actual behavior (TUI prompts, the exiftool invocation, the written XMP tags) can only be reliably checked by actually running it.

## Procedure

```bash
npm run check

npm pack
npm install -g ./mkorun-aiprov-0.1.0.tgz   # add --prefix <temp-dir> if you don't have write access to the global npm prefix

aiprov --help
aiprov --version

cp some-test-image.png aiprov-test.png
aiprov aiprov-test.png

exiftool -XMP:all -G1 -a aiprov-test.png
```

## Positive checks

| Field | Expected |
|---|---|
| `XMP-dc:Creator` | set |
| `XMP-xmp:CreateDate` | set |
| `XMP-dc:Description` | set, or deliberately left empty |
| `XMP-dc:Subject` | set |
| `XMP-iptcExt:DigitalSourceType` | `trainedAlgorithmicMedia` |
| `XMP-photoshop:Credit` | `Michael Kortstiege / <Tool>` |
| `XMP-<namespace>:aiTool` | set |
| `XMP-<namespace>:destination` | set |
| `XMP-<namespace>:aiPrompt` | set, if provided |

## Negative checks

| Field | Expected |
|---|---|
| `XMP-dc:rights` | not set automatically |
| `XMP-xmpRights:WebStatement` | not set automatically |
| `acquireLicensePage` | not set automatically |

Only publish once both tables check out.

## Post-publish smoke test

After `npm publish`, verify the package resolves correctly from the registry itself — not just from your local tarball:

```bash
npm view @mkorun/aiprov
npx @mkorun/aiprov --help
npx @mkorun/aiprov --version
```

Note: `npx` caches packages locally. For a first-ever publish of a version this is a non-issue, but on subsequent releases use `npx --yes @mkorun/aiprov@latest` to force resolution against the registry instead of a potentially stale cached copy.

## Verification Log

| Version | Date | Node | npm | ExifTool | Result | Note |
|---|---|---|---|---|---|---|
| 0.1.0 | 2026-07-09 | v24.18.0 | 11.16.0 | 13.25 | ✅ | All positive/negative checks passed; `aiPrompt` explicitly filled in and verified, `description` deliberately left empty and correctly not written. |
| 0.1.0 | 2026-07-09 | v24.18.0 | 11.16.0 | — | ✅ | Post-publish smoke test: `npm view` and `npx @mkorun/aiprov@latest --help`/`--version` resolved correctly from the registry (~5 min after publish; briefly 404 right after publish, then resolved — registry replication delay). |
