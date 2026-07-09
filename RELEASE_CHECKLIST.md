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

## Verification Log

| Version | Date | Node | npm | ExifTool | Result | Note |
|---|---|---|---|---|---|---|
| 0.1.0 | 2026-07-09 | v24.18.0 | 11.16.0 | 13.25 | ✅ | All positive/negative checks passed; `aiPrompt` explicitly filled in and verified, `description` deliberately left empty and correctly not written. |
