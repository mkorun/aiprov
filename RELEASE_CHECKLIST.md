# Release Checklist

Manueller Verifikationsablauf vor jedem `npm publish`. Kein automatisierter Test — bewusst interaktiv, weil das eigentliche Verhalten (TUI-Prompts, exiftool-Aufruf, geschriebene XMP-Tags) am Ende nur durch echtes Ausführen zuverlässig geprüft wird.

## Ablauf

```bash
npm run check

npm pack
npm install -g ./mkorun-aiprov-0.1.0.tgz   # ggf. --prefix <temp-dir> falls kein Schreibzugriff auf den globalen npm-Prefix

aiprov --help
aiprov --version

cp irgendein-testbild.png aiprov-test.png
aiprov aiprov-test.png

exiftool -XMP:all -G1 -a aiprov-test.png
```

## Positiv-Prüfung

| Feld | Erwartung |
|---|---|
| `XMP-dc:Creator` | gesetzt |
| `XMP-xmp:CreateDate` | gesetzt |
| `XMP-dc:Description` | gesetzt oder bewusst leer |
| `XMP-dc:Subject` | gesetzt |
| `XMP-iptcExt:DigitalSourceType` | `trainedAlgorithmicMedia` |
| `XMP-photoshop:Credit` | `Michael Kortstiege / <Tool>` |
| `XMP-<namespace>:aiTool` | gesetzt |
| `XMP-<namespace>:destination` | gesetzt |
| `XMP-<namespace>:aiPrompt` | gesetzt, falls eingegeben |

## Negativ-Prüfung

| Feld | Erwartung |
|---|---|
| `XMP-dc:rights` | nicht automatisch gesetzt |
| `XMP-xmpRights:WebStatement` | nicht automatisch gesetzt |
| `acquireLicensePage` | nicht automatisch gesetzt |

Erst wenn beide Tabellen passen: veröffentlichen.

## Verification Log

| Version | Datum | Node | npm | ExifTool | Ergebnis | Notiz |
|---|---|---|---|---|---|---|
| 0.1.0 | 2026-07-09 | v24.18.0 | 11.16.0 | 13.25 | ✅ | Alle Positiv-/Negativ-Prüfungen bestanden; `aiPrompt` explizit befüllt und verifiziert, `description` bewusst leer gelassen und korrekt nicht geschrieben. |
