# aiprov

Interactive TUI for writing IPTC/XMP provenance metadata to AI-generated images.

Writes machine-readable XMP fields — including the IPTC `DigitalSourceType` value for generative AI media — directly into a source image (PNG, JPEG, TIFF; also WebP and AVIF/HEIF when used as source). These fields can support AI-image disclosure workflows, including those required by EU AI Act Art. 50 transparency obligations.

Art. 50 also requires a human-visible indication (badge, caption, alt text) — that part depends on your publishing setup.

See [Article](https://teblo.de/ki-bilder-kennzeichnen/) (German)

---

## Quickstart

```bash
# Run without installing (always fetches the latest version)
npx @mkorun/aiprov my-image.png

# Or install as a dev dependency in your project
npm install --save-dev @mkorun/aiprov
npx aiprov my-image.png

# Bun
bun add -d @mkorun/aiprov
bunx aiprov my-image.png
```

**Requires:** [ExifTool](https://exiftool.org/) installed on your system (see below).

---

## Requirements

### Runtime

The published CLI (`dist/index.js`) runs on **Node.js ≥ 18** or **Bun ≥ 1.0**.

Running the TypeScript source directly (`bun index.ts`) requires **Bun**. Node cannot run `.ts` files directly.

### ExifTool

**Linux / WSL2 / macOS:**
```bash
# Debian/Ubuntu/WSL2
sudo apt install libimage-exiftool-perl

# macOS
brew install exiftool
```

**Windows:**

```powershell
# Recommended — built into Windows 10/11, supports winget upgrade
winget install exiftool

# Alternative (requires Chocolatey)
choco install exiftool
```

If neither package manager is available: download the standalone `.exe` from [exiftool.org](https://exiftool.org/), rename `exiftool(-k).exe` to `exiftool.exe`, and place it on your `PATH`.

---

## Usage

```bash
aiprov my-image.png
```

The TUI reads existing tags, pre-fills all fields, and runs `exiftool` after confirmation.

### Fields written

| Field | Description |
|---|---|
| `XMP-dc:Creator` | Author / creator (machine-readable entity) |
| `XMP-xmp:CreateDate` | Creation date; time always `00:00:00` (privacy) |
| `XMP-dc:Description` | Short description of the image content (optional) |
| `XMP-dc:Subject` | Tags, comma-separated (e.g. `AI-generated, Ideogram`) |
| `XMP-iptcExt:DigitalSourceType` | `trainedAlgorithmicMedia` — IPTC value for generative AI media; can support AI disclosure workflows |
| `XMP-photoshop:Credit` | Display credit string, e.g. `"Jane Doe / Ideogram"` — maps to `creditText` in schema.org |
| `XMP-<ns>:aiTool` | AI tool used (`Ideogram`, `Midjourney`, `DALL-E` …) |
| `XMP-<ns>:destination` | Target site (`example.com` …) |
| `XMP-<ns>:aiPrompt` | Full generation prompt — stripped from web derivatives |

`<ns>` is the custom namespace prefix from `config.json` (default: `myns`).

### Priority

Existing XMP tags in the image > `config.json` defaults > built-in fallbacks

---

## Configuration

On first run, aiprov starts an interactive setup wizard that creates `config.json` for you.

Config location: `~/.config/aiprov/config.json`

Override with an environment variable:
```bash
AIPROV_CONFIG_DIR=/custom/path aiprov image.png
```

To edit afterwards, open the file directly. Format:

```json
{
  "namespace":    "myns",
  "namespaceUrl": "https://mysite.com/xmp/myns/1.0/",
  "creator":      "Your Name",
  "subject":      "AI-generated",
  "dstType":      "trainedAlgorithmicMedia",
  "aiTool":       "Ideogram",
  "destination":  "mysite.com"
}
```

`ExifTool_config` (the Perl custom-namespace definition) is generated automatically from `config.json` on each run — no manual editing required.

### Custom namespace

The `myns:` prefix (or whatever you set in `namespace`) defines fields for internal use — primarily `aiPrompt`. Since these are in your own namespace, they can be selectively stripped from web derivatives without touching the public provenance fields.

**NCName rule:** The namespace prefix must not contain hyphens. Use `myns`, `acme`, `mko` — not `my-ns`.

---

## Language

The TUI language is auto-detected from the `LANG` environment variable. Falls back to English.

| `LANG` | Language |
|---|---|
| `de_*` | Deutsch |
| `fr_*` | Français |
| `es_*` | Español |
| `it_*` | Italiano |
| anything else | English (default) |

Override for a single run:
```bash
LANG=de_DE.UTF-8 aiprov image.png
```

---

## Bun (direct execution from source)

```bash
git clone https://github.com/mkorun/aiprov
cd aiprov
bun index.ts my-image.png
# or link globally
bun link
aiprov my-image.png
```

---

## Build (npm package from source)

```bash
npm install
npm run build
# dist/index.js is ready with #!/usr/bin/env node shebang
```

---

## Why ExifTool and not a native library?

Two Rust ports exist (`exiftool-rs`, `exif-oxide`) but both explicitly drop custom tag configuration — a custom namespace schema like `myns:` would not work with either. ExifTool is a moving target (monthly releases); both ports chase it and shed the hardest parts first. For a tool that depends on a custom namespace, ExifTool + Perl is the only reliable option today.

---

---

## Structured Data & Licensing — Design Decisions (ADR)

### Context

SEO tools, including Google Search Console, may report up to four `ImageObject` fields as missing in structured data: `creditText`, `copyrightNotice`, `license`, `acquireLicensePage`. Google documents these in its [image license metadata guide](https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata). The same fields map to XMP/IPTC metadata in image files.

### What aiprov implements

| XMP field | schema.org field | Decision |
|---|---|---|
| `XMP-photoshop:Credit` | `creditText` | ✓ Written — display credit, e.g. `"Jane Doe / Ideogram"` |
| `XMP-iptcExt:DigitalSourceType` | `digitalSourceType` | ✓ Written — `trainedAlgorithmicMedia` |
| `XMP-dc:Creator` | `creator` | ✓ Written — machine-readable creator entity |
| `XMP-dc:Description` | `description` (ImageObject) | ✓ Written — image content description |

### What aiprov deliberately omits — and why

aiprov does not write `copyrightNotice`, `license`, or `acquireLicensePage` by default. For AI-generated images, these fields may imply rights or licensing statements that depend on jurisdiction, the degree of human creative input, and individual legal assessment. aiprov therefore focuses on provenance and disclosure metadata instead.

**Background on `copyrightNotice` → `XMP-dc:rights`**

In many jurisdictions (including Germany/EU under §§ 2, 7 UrhG and EuGH *Painer*, C-145/10), copyright requires a personal intellectual creation by a natural person. For standard AI-generated images where the model makes the decisive creative choices, the copyright status of the output is legally uncertain or unprotected. Adding a copyright notice may imply rights that do not exist — consult your local laws and legal counsel if you need to make a copyright claim.

**Background on `license` → `XMP-xmpRights:WebStatement`**

A license is a grant of rights. If copyright status is unclear, a standard Creative Commons license (CC BY, CC BY-NC, etc.) may create an inconsistent signal. **CC0** (Public Domain Dedication) includes a "no rights to waive" clause and may be a more appropriate option to evaluate if you want to signal open reuse for AI-generated images — but this still depends on your jurisdiction and publishing context.

**`acquireLicensePage`**

Only meaningful if you have a licensing page to link to. Omit if you have no such page.

### What `DigitalSourceType` provides

`XMP-iptcExt:DigitalSourceType: trainedAlgorithmicMedia` is the IPTC-standardized machine-readable signal for AI-generated content ([IPTC guidance for AI-generated media](https://iptc.org/news/iptc-publishes-metadata-guidance-for-ai-generated-synthetic-media/)). It communicates how the image was created — separate from, and not a replacement for, copyright or licensing information.

Note: `DigitalSourceType` is not a legal compliance solution. It is a standardized disclosure signal. Whether additional steps are required depends on your use case and applicable law.

Note: Google Search Console may report `copyrightNotice`, `license`, `creditText`, and `acquireLicensePage` as missing in image structured data. These are classified as **non-critical** improvement suggestions — they do not affect indexing or ranking. See [Google's image license metadata guide](https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata) for context.

### For JSON-LD publishers

The same reasoning applies to `ImageObject` in JSON-LD structured data (e.g. in `BlogPosting` schema):

| JSON-LD field | Source | Decision |
|---|---|---|
| `creditText` | `XMP-photoshop:Credit` (→ `XMP-dc:Creator` as fallback) | ✓ Populate from image XMP |
| `description` | `XMP-dc:Description` | ✓ Populate from image XMP |
| `digitalSourceType` | `XMP-iptcExt:DigitalSourceType` | ✓ Populate from image XMP |
| `license` | — | ✗ Omit by default — copyright status of AI images is jurisdiction-dependent |
| `copyrightNotice` | — | ✗ Omit by default — same reason; consult legal counsel if needed |
| `acquireLicensePage` | — | ✗ Omit unless you have a licensing page to link |

Important: `creditText` must come from the **image's** XMP metadata, not from the article's `author:` field. The article author and the image creator are different roles (e.g. a guest author writes the article, but the site owner created the image).

---

## Further reading

- [IPTC DigitalSourceType vocabulary](https://cv.iptc.org/newscodes/digitalsourcetype/)
- [EU AI Act Art. 50 (transparency obligations)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689)
- [Google image license metadata guide](https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata)
- [schema.org ImageObject](https://schema.org/ImageObject)
- [ExifTool custom namespace docs](https://exiftool.sourceforge.net/config.html)
