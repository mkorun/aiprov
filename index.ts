#!/usr/bin/env node
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { mkdir, open, readFile, writeFile, stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'

const configDir = process.env.AIPROV_CONFIG_DIR
	? process.env.AIPROV_CONFIG_DIR
	: join(homedir(), '.config', 'aiprov')

// ── ANSI colors ──────────────────────────────────────────────────────────────

const tty = stdout.isTTY
const esc = (code: string) => (s: string) => tty ? `\x1b[${code}m${s}\x1b[0m` : s

const bold   = esc('1')
const dim    = esc('2')
const cyan   = esc('36')
const yellow = esc('33')
const green  = esc('32')
const red    = esc('31')
const gray   = esc('90')

const hr = (char = '─', width = 52) => gray(char.repeat(width))

// ── i18n — auto-detect via LANG env, fallback: English ───────────────────────

type Lang = 'en' | 'de' | 'fr' | 'es' | 'it'
const supported: Record<string, Lang> = { de: 'de', fr: 'fr', es: 'es', it: 'it' }
const lang: Lang = supported[process.env.LANG?.slice(0, 2) ?? ''] ?? 'en'

const strings: Record<Lang, {
	usage:             string
	fileNotFound:      (f: string) => string
	notAnImage:        (f: string) => string
	supported:         string
	noExiftool:        string
	title:             string
	fileLabel:         string
	noMeta:            string
	existingTags:      string
	fillFields:        string
	dateHint:          string
	descHint:          string
	subjectHint:       string
	creditHint:        string
	promptHint:        string
	previewTitle:      string
	confirm:           string
	confirmHint:       string
	cancelled:         string
	success:           string
	error:             string
	setupTitle:        string
	setupDesc:         string
	setupNamespace:    string
	setupNamespaceUrl: string
	setupCreator:      string
	setupSubject:      string
	setupAiTool:       string
	setupDestination:  string
	setupDone:         (path: string) => string
}> = {
	en: {
		usage:             'Usage: aiprov <image-file>',
		fileNotFound:      (f) => `File not found: ${f}`,
		notAnImage:        (f) => `Not an image file: ${f}`,
		supported:         '  Supported: PNG, JPEG, WebP, TIFF, AVIF/HEIF',
		noExiftool:        'exiftool not found. Install: sudo apt install libimage-exiftool-perl',
		title:             'AI Image Provenance Tagging',
		fileLabel:         'File:',
		noMeta:            '  (no XMP metadata found)',
		existingTags:      '  Existing tags:',
		fillFields:        '  Fill in fields — press Enter to keep value in [ ]',
		dateHint:          'XMP-xmp:CreateDate  (YYYY-MM-DD or DD.MM.YYYY, optional + HH:MM[:SS])',
		descHint:          'XMP-dc:Description  (short description, optional)',
		subjectHint:       'XMP-dc:Subject  (comma-separated)',
		creditHint:        'XMP-photoshop:Credit  (display credit, e.g. "Jane Doe / Ideogram")',
		promptHint:        'XMP-mko:aiPrompt  (full prompt — stripped from web derivatives)',
		previewTitle:      '  exiftool command',
		confirm:           '  Execute? ',
		confirmHint:       '[Y/n]',
		cancelled:         '  Cancelled.',
		success:           'Successfully tagged.',
		error:             'exiftool error:',
		setupTitle:        'First run — set up your defaults',
		setupDesc:         '  These values pre-fill the TUI on every run. Press Enter to accept the suggestion.',
		setupNamespace:    'Namespace prefix  (NCName: no hyphens, e.g. "myns")',
		setupNamespaceUrl: 'Namespace URL  (your domain, e.g. https://example.com/xmp/ns/1.0/ — leave blank to auto-generate)',
		setupCreator:      'Default creator  (e.g. "Jane Doe" or "Acme Corp")',
		setupSubject:      'Default subject tags  (comma-separated)',
		setupAiTool:       'Default AI tool  (e.g. Ideogram, Midjourney, DALL-E)',
		setupDestination:  'Default destination site  (domain only, e.g. example.com)',
		setupDone:         (p) => `  Config saved — edit anytime: ${p}`,
	},
	de: {
		usage:             'Verwendung: aiprov <bilddatei>',
		fileNotFound:      (f) => `Datei nicht gefunden: ${f}`,
		notAnImage:        (f) => `Keine Bilddatei: ${f}`,
		supported:         '  Unterstützt: PNG, JPEG, WebP, TIFF, AVIF/HEIF',
		noExiftool:        'exiftool nicht gefunden. Installation: sudo apt install libimage-exiftool-perl',
		title:             'KI-Bild-Provenance-Tagging',
		fileLabel:         'Datei:',
		noMeta:            '  (noch keine XMP-Metadaten vorhanden)',
		existingTags:      '  Vorhandene Tags:',
		fillFields:        '  Felder befüllen — Enter übernimmt den Wert in [ ]',
		dateHint:          'XMP-xmp:CreateDate  (JJJJ-MM-TT oder TT.MM.JJJJ, optional + HH:MM[:SS])',
		descHint:          'XMP-dc:Description  (Kurzbeschreibung, optional)',
		subjectHint:       'XMP-dc:Subject  (kommagetrennt)',
		creditHint:        'XMP-photoshop:Credit  (Bildnachweis, z.B. "Max Mustermann / Ideogram")',
		promptHint:        'XMP-mko:aiPrompt  (vollständiger Prompt — wird aus Derivaten entfernt)',
		previewTitle:      '  exiftool-Befehl',
		confirm:           '  Ausführen? ',
		confirmHint:       '[J/n]',
		cancelled:         '  Abgebrochen.',
		success:           'Erfolgreich getaggt.',
		error:             'exiftool-Fehler:',
		setupTitle:        'Erster Start — Standardwerte einrichten',
		setupDesc:         '  Diese Werte werden im TUI vorausgefüllt. Enter übernimmt den Vorschlag.',
		setupNamespace:    'Namespace-Präfix  (NCName: keine Bindestriche, z.B. "myns")',
		setupNamespaceUrl: 'Namespace-URL  (eigene Domain, z.B. https://example.com/xmp/ns/1.0/ — leer lassen für automatische Generierung)',
		setupCreator:      'Standard-Ersteller  (z.B. "Max Mustermann" oder "Muster GmbH")',
		setupSubject:      'Standard-Tags  (kommagetrennt)',
		setupAiTool:       'Standard-KI-Tool  (z.B. Ideogram, Midjourney, DALL-E)',
		setupDestination:  'Standard-Ziel-Website  (nur Domain, z.B. example.com)',
		setupDone:         (p) => `  Konfiguration gespeichert — jederzeit editierbar: ${p}`,
	},
	fr: {
		usage:             'Utilisation : aiprov <fichier-image>',
		fileNotFound:      (f) => `Fichier introuvable : ${f}`,
		notAnImage:        (f) => `Fichier image non reconnu : ${f}`,
		supported:         '  Formats pris en charge : PNG, JPEG, WebP, TIFF, AVIF/HEIF',
		noExiftool:        'exiftool introuvable. Installation : sudo apt install libimage-exiftool-perl',
		title:             'Métadonnées XMP — Images générées par IA',
		fileLabel:         'Fichier :',
		noMeta:            '  (aucune métadonnée XMP trouvée)',
		existingTags:      '  Tags existants :',
		fillFields:        '  Remplir les champs — Entrée conserve la valeur dans [ ]',
		dateHint:          'XMP-xmp:CreateDate  (AAAA-MM-JJ ou JJ.MM.AAAA, optionnel + HH:MM[:SS])',
		descHint:          'XMP-dc:Description  (description courte, optionnelle)',
		subjectHint:       'XMP-dc:Subject  (séparés par des virgules)',
		creditHint:        'XMP-photoshop:Credit  (crédit affiché, ex. "Jean Dupont / Midjourney")',
		promptHint:        'XMP-mko:aiPrompt  (prompt complet — supprimé des dérivés web)',
		previewTitle:      '  commande exiftool',
		confirm:           '  Exécuter ? ',
		confirmHint:       '[O/n]',
		cancelled:         '  Annulé.',
		success:           'Métadonnées enregistrées avec succès.',
		error:             'Erreur exiftool :',
		setupTitle:        'Premier lancement — configuration des valeurs par défaut',
		setupDesc:         '  Ces valeurs pré-remplissent le TUI à chaque démarrage. Entrée accepte la suggestion.',
		setupNamespace:    'Préfixe d\'espace de noms  (NCName : sans tirets, ex. "myns")',
		setupNamespaceUrl: 'URL de l\'espace de noms  (votre domaine, ex. https://example.com/xmp/ns/1.0/ — laisser vide pour génération automatique)',
		setupCreator:      'Créateur par défaut  (ex. "Jean Dupont" ou "Société XYZ")',
		setupSubject:      'Mots-clés par défaut  (séparés par des virgules)',
		setupAiTool:       'Outil IA par défaut  (ex. Ideogram, Midjourney, DALL-E)',
		setupDestination:  'Site de destination par défaut  (domaine seul, ex. example.com)',
		setupDone:         (p) => `  Configuration enregistrée — modifiable à tout moment : ${p}`,
	},
	es: {
		usage:             'Uso: aiprov <archivo-imagen>',
		fileNotFound:      (f) => `Archivo no encontrado: ${f}`,
		notAnImage:        (f) => `No es un archivo de imagen: ${f}`,
		supported:         '  Formatos admitidos: PNG, JPEG, WebP, TIFF, AVIF/HEIF',
		noExiftool:        'exiftool no encontrado. Instalación: sudo apt install libimage-exiftool-perl',
		title:             'Metadatos XMP — Imágenes generadas por IA',
		fileLabel:         'Archivo:',
		noMeta:            '  (sin metadatos XMP)',
		existingTags:      '  Etiquetas existentes:',
		fillFields:        '  Rellenar campos — Enter conserva el valor en [ ]',
		dateHint:          'XMP-xmp:CreateDate  (AAAA-MM-DD o DD.MM.AAAA, opcional + HH:MM[:SS])',
		descHint:          'XMP-dc:Description  (descripción breve, opcional)',
		subjectHint:       'XMP-dc:Subject  (separados por comas)',
		creditHint:        'XMP-photoshop:Credit  (crédito a mostrar, ej. "Juan Pérez / Ideogram")',
		promptHint:        'XMP-mko:aiPrompt  (prompt completo — eliminado de los derivados web)',
		previewTitle:      '  comando exiftool',
		confirm:           '  ¿Ejecutar? ',
		confirmHint:       '[S/n]',
		cancelled:         '  Cancelado.',
		success:           'Metadatos guardados correctamente.',
		error:             'Error de exiftool:',
		setupTitle:        'Primera ejecución — configurar valores predeterminados',
		setupDesc:         '  Estos valores rellenan previamente el TUI. Enter acepta la sugerencia.',
		setupNamespace:    'Prefijo de espacio de nombres  (NCName: sin guiones, ej. "myns")',
		setupNamespaceUrl: 'URL del espacio de nombres  (su dominio, ej. https://example.com/xmp/ns/1.0/ — dejar vacío para generación automática)',
		setupCreator:      'Creador predeterminado  (ej. "Juan Pérez" o "Empresa ABC")',
		setupSubject:      'Etiquetas predeterminadas  (separadas por comas)',
		setupAiTool:       'Herramienta IA predeterminada  (ej. Ideogram, Midjourney, DALL-E)',
		setupDestination:  'Sitio de destino predeterminado  (solo dominio, ej. example.com)',
		setupDone:         (p) => `  Configuración guardada — editable en cualquier momento: ${p}`,
	},
	it: {
		usage:             'Utilizzo: aiprov <file-immagine>',
		fileNotFound:      (f) => `File non trovato: ${f}`,
		notAnImage:        (f) => `Non è un file immagine: ${f}`,
		supported:         '  Formati supportati: PNG, JPEG, WebP, TIFF, AVIF/HEIF',
		noExiftool:        'exiftool non trovato. Installazione: sudo apt install libimage-exiftool-perl',
		title:             'Metadati XMP — Immagini generate da IA',
		fileLabel:         'File:',
		noMeta:            '  (nessun metadato XMP trovato)',
		existingTags:      '  Tag esistenti:',
		fillFields:        '  Compila i campi — Invio mantiene il valore in [ ]',
		dateHint:          'XMP-xmp:CreateDate  (AAAA-MM-GG o GG.MM.AAAA, opzionale + HH:MM[:SS])',
		descHint:          'XMP-dc:Description  (descrizione breve, opzionale)',
		subjectHint:       'XMP-dc:Subject  (separati da virgole)',
		creditHint:        'XMP-photoshop:Credit  (credito da mostrare, es. "Mario Rossi / Ideogram")',
		promptHint:        'XMP-mko:aiPrompt  (prompt completo — rimosso dai derivati web)',
		previewTitle:      '  comando exiftool',
		confirm:           '  Eseguire? ',
		confirmHint:       '[S/n]',
		cancelled:         '  Annullato.',
		success:           'Metadati salvati con successo.',
		error:             'Errore exiftool:',
		setupTitle:        'Primo avvio — configurazione dei valori predefiniti',
		setupDesc:         '  Questi valori precompilano il TUI ad ogni avvio. Invio accetta il suggerimento.',
		setupNamespace:    'Prefisso dello spazio dei nomi  (NCName: senza trattini, es. "myns")',
		setupNamespaceUrl: 'URL dello spazio dei nomi  (proprio dominio, es. https://example.com/xmp/ns/1.0/ — lasciare vuoto per generazione automatica)',
		setupCreator:      'Creatore predefinito  (es. "Mario Rossi" o "Azienda XYZ")',
		setupSubject:      'Tag predefiniti  (separati da virgole)',
		setupAiTool:       'Strumento IA predefinito  (es. Ideogram, Midjourney, DALL-E)',
		setupDestination:  'Sito di destinazione predefinito  (solo dominio, es. example.com)',
		setupDone:         (p) => `  Configurazione salvata — modificabile in qualsiasi momento: ${p}`,
	},
}

const t = strings[lang]

// ── subprocess helper (Node.js + Bun compatible) ─────────────────────────────

const spawnAsync = (cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> =>
	new Promise((resolve) => {
		const proc = spawn(cmd, args)
		let out = '', err = ''
		proc.stdout.on('data', (d: Buffer) => { out += d.toString() })
		proc.stderr.on('data', (d: Buffer) => { err += d.toString() })
		proc.on('close', (code) => resolve({ stdout: out, stderr: err, code: code ?? 0 }))
		proc.on('error', () => resolve({ stdout: '', stderr: '', code: 1 }))
	})

// ── argument handling ────────────────────────────────────────────────────────

const argv = process.argv.slice(2)

if (argv.includes('--version') || argv.includes('-V')) {
	console.log('0.1.0')
	process.exit(0)
}

if (argv.includes('--help') || argv.includes('-h')) {
	console.log(`${bold('aiprov')} 0.1.0 — AI Image Provenance Tagging\n\n${t.usage}\n`)
	process.exit(0)
}

await mkdir(configDir, { recursive: true })

// ── config path (self-contained — no global ~/.ExifTool_config needed) ───────

const configPath = join(configDir, 'ExifTool_config')

const file = argv[0]
if (!file) {
	console.error(red(t.usage))
	process.exit(1)
}

try { await stat(file) } catch {
	console.error(red(t.fileNotFound(file)))
	process.exit(1)
}

// magic bytes check: read first 12 bytes
const fh = await open(file, 'r')
const byteBuf = Buffer.allocUnsafe(12)
await fh.read(byteBuf, 0, 12, 0)
await fh.close()
const bytes = new Uint8Array(byteBuf)

const isPng  = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF
const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
            && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
const isTiff = (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2A && bytes[3] === 0x00)
            || (bytes[0] === 0x4D && bytes[1] === 0x4D && bytes[2] === 0x00 && bytes[3] === 0x2A)
const isFtyp    = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
const ftypBrand  = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
const isAvifHeif = isFtyp && /^(avif|avis|heic|heix|mif1|msf1|hevc|hevx)$/.test(ftypBrand)
if (!isPng && !isJpeg && !isWebp && !isTiff && !isAvifHeif) {
	console.error(red(t.notAnImage(file)))
	console.error(red(t.supported))
	process.exit(1)
}

const exiftoolCheck = await spawnAsync('exiftool', ['-ver'])
if (exiftoolCheck.code !== 0) {
	console.error(red(t.noExiftool))
	process.exit(1)
}

// ── filesystem mtime as CreateDate fallback ──────────────────────────────────

const mtime = (await stat(file)).mtime
const p = (n: number) => String(n).padStart(2, '0')
const mtimeStr = `${mtime.getFullYear()}-${p(mtime.getMonth() + 1)}-${p(mtime.getDate())}T00:00:00`

// ── readline + ask — initialized early (also used for setup wizard) ──────────

const rl = createInterface({ input: stdin, output: stdout })

const ask = async (label: string, def: string): Promise<string> => {
	const hint = def ? `  ${dim('[' + def + ']')}` : ''
	const prompt = `${cyan('  ' + label)}${hint}\n  ${gray('›')} `
	const answer = await rl.question(prompt)
	return answer.trim() || def
}

// ── config.json — configurable defaults ──────────────────────────────────────

type UserConfig = {
	namespace?:    string
	namespaceUrl?: string
	creator?:      string
	subject?:      string
	dstType?:      string
	aiTool?:       string
	destination?:  string
}

const configJsonPath = join(configDir, 'config.json')
let cfg: UserConfig = {}

try {
	cfg = JSON.parse(await readFile(configJsonPath, 'utf-8'))
} catch (e: unknown) {
	if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
		console.log()
		console.log(hr())
		console.log(bold(cyan('  ' + t.setupTitle)))
		console.log(hr())
		console.log(dim(t.setupDesc))
		console.log()

		let setupNs = 'myns'
		for (;;) {
			setupNs = await ask(t.setupNamespace, 'myns')
			if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(setupNs)) break
			console.log(red('  ✗ Invalid: letters, digits, underscores only — no hyphens (e.g. "myns")'))
		}
		const setupDestRaw = await ask(t.setupDestination, '')
		const setupDest   = setupDestRaw.replace(/^https?:\/\//i, '').replace(/\/$/, '')
		const autoNsUrl   = setupDest
			? `https://${setupDest}/xmp/${setupNs}/1.0/`
			: `https://example.com/xmp/${setupNs}/1.0/`
		const setupNsUrl  = await ask(t.setupNamespaceUrl, autoNsUrl)
		const setupCr     = await ask(t.setupCreator,      '')
		const setupSubj   = await ask(t.setupSubject,      'AI-generated')
		const setupTool   = await ask(t.setupAiTool,       '')

		cfg = {
			namespace:    setupNs,
			namespaceUrl: setupNsUrl || autoNsUrl,
			creator:      setupCr,
			subject:      setupSubj || 'AI-generated',
			dstType:      'trainedAlgorithmicMedia',
			aiTool:       setupTool,
			destination:  setupDest,
		}

		await writeFile(configJsonPath, JSON.stringify(cfg, null, 2) + '\n')
		console.log()
		console.log(green('  ✓ ') + dim(t.setupDone(configJsonPath)))
		console.log()
		console.log(hr())
		console.log()
	} else {
		console.error(red(`Invalid config file: ${configJsonPath}`))
		console.error(red((e as Error).message))
		process.exit(1)
	}
}

const ns    = cfg.namespace    ?? 'myns'
const nsUrl = cfg.namespaceUrl ?? 'https://example.com/xmp/myns/1.0/'

if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ns)) {
	console.error(red(`Invalid namespace prefix in config: "${ns}"`))
	console.error(red('Only letters, digits and underscores allowed — no hyphens.'))
	console.error(red(`Edit: ${configJsonPath}`))
	process.exit(1)
}

const perlQuote = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

const newExifConfig = [
	`# Generated by aiprov from config.json — do not edit manually.`,
	`%Image::ExifTool::UserDefined = (`,
	`    'Image::ExifTool::XMP::Main' => {`,
	`        ${ns} => { SubDirectory => { TagTable => 'Image::ExifTool::UserDefined::${ns}' } },`,
	`    },`,
	`);`,
	`%Image::ExifTool::UserDefined::${ns} = (`,
	`    GROUPS    => { 0 => 'XMP', 1 => 'XMP-${ns}', 2 => 'Image' },`,
	`    NAMESPACE => { '${perlQuote(ns)}' => '${perlQuote(nsUrl)}' },`,
	`    WRITABLE  => 'string',`,
	`    aiTool      => { },`,
	`    destination => { },`,
	`    aiPrompt    => { },`,
	`);`,
	`1;`,
].join('\n') + '\n'
let existingExifConfig = ''
try { existingExifConfig = await readFile(configPath, 'utf-8') } catch {}
if (existingExifConfig !== newExifConfig) await writeFile(configPath, newExifConfig)

// ── read existing metadata ───────────────────────────────────────────────────

const metaResult = await spawnAsync('exiftool', ['-config', configPath, '-G1', '-a', '-j', file])
let existing: Record<string, unknown> = {}
try { existing = (JSON.parse(metaResult.stdout) as Record<string, unknown>[])[0] ?? {} } catch {}

const get = (key: string): string => {
	const lower = key.toLowerCase()
	for (const [k, v] of Object.entries(existing)) {
		if (k.toLowerCase() === lower) {
			if (Array.isArray(v)) return (v as string[]).join(', ')
			if (typeof v === 'string') return v
		}
	}
	return ''
}

const existingDate = get('XMP-xmp:CreateDate')
const normalizeDate = (d: string): string => {
	if (!d) return ''
	const s = d.trim()
	const timeMatch = s.match(/[\sT](\d{1,2}):(\d{2})(?::(\d{2}))?$/)
	const timeSuffix = timeMatch
		? `T${timeMatch[1].padStart(2,'0')}:${timeMatch[2]}:${timeMatch[3] ?? '00'}`
		: 'T00:00:00'
	const datePart = timeMatch ? s.slice(0, -timeMatch[0].length) : s
	const iso = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
	if (iso) return `${iso[1]}-${iso[2].padStart(2,'0')}-${iso[3].padStart(2,'0')}${timeSuffix}`
	const de = datePart.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)
	if (de) return `${de[3]}-${de[2].padStart(2,'0')}-${de[1].padStart(2,'0')}${timeSuffix}`
	const et = s.match(/^(\d{4}):(\d{2}):(\d{2})(?:\s+(\d{2}:\d{2}:\d{2}))?/)
	if (et) return `${et[1]}-${et[2]}-${et[3]}T${et[4] ?? '00:00:00'}`
	return s
}

const defaults = {
	creator:     get('XMP-dc:Creator')                || cfg.creator     || '',
	createDate:  (normalizeDate(existingDate) || mtimeStr).replace(/T00:00:00$/, ''),
	description: get('XMP-dc:Description'),
	subject:     get('XMP-dc:Subject')                || cfg.subject     || 'AI-generated',
	dstType:     get('XMP-iptcExt:DigitalSourceType') || cfg.dstType     || 'trainedAlgorithmicMedia',
	aiTool:      get(`XMP-${ns}:AiTool`)              || cfg.aiTool      || '',
	destination: get(`XMP-${ns}:Destination`)         || cfg.destination || '',
	credit:      get('XMP-photoshop:Credit'),
	aiPrompt:    get(`XMP-${ns}:AiPrompt`),
}

// ── Header ───────────────────────────────────────────────────────────────────

console.log()
console.log(hr())
console.log(bold(cyan('  ' + t.title)))
console.log(hr())
console.log(`  ${bold(t.fileLabel)} ${file}`)
console.log()

// ── existing tags ────────────────────────────────────────────────────────────

const relevant = Object.entries(existing).filter(([k]) =>
	/creator|createdate|description|subject|digitalsource|credit|aitool|destination|aiprompt/i.test(k)
)

if (relevant.length) {
	console.log(dim(t.existingTags))
	for (const [k, v] of relevant) {
		const display = Array.isArray(v) ? (v as string[]).join(', ') : String(v)
		const truncated = display.length > 72 ? display.slice(0, 72) + '…' : display
		console.log(`  ${yellow(k)}: ${truncated}`)
	}
} else {
	console.log(dim(t.noMeta))
}

console.log()
console.log(hr())
console.log(dim(t.fillFields))
console.log(hr())
console.log()

// ── interactive input ────────────────────────────────────────────────────────

const creator       = await ask('XMP-dc:Creator', defaults.creator)
const createDateRaw = await ask(t.dateHint, defaults.createDate)
const createDate    = normalizeDate(createDateRaw) || createDateRaw
const description   = await ask(t.descHint, defaults.description)
const subjectRaw    = await ask(t.subjectHint, defaults.subject)
const dstType       = await ask('XMP-iptcExt:DigitalSourceType', defaults.dstType)
const aiTool        = await ask(`XMP-${ns}:aiTool`, defaults.aiTool)
const creditDefault = defaults.credit || [creator, aiTool].filter(Boolean).join(' / ')
const credit        = await ask(t.creditHint, creditDefault)
const destination   = await ask(`XMP-${ns}:destination`, defaults.destination)
const aiPrompt      = await ask(t.promptHint.replace('mko:', `${ns}:`), defaults.aiPrompt)

const subjects = subjectRaw.split(',').map(s => s.trim()).filter(Boolean)

// ── exiftool arguments ───────────────────────────────────────────────────────

const args = [
	'-config', configPath,
	'-all=', '-tagsfromfile', '@', '-icc_profile',
	'-overwrite_original',
	`-XMP-dc:Creator=${creator}`,
	`-XMP-xmp:CreateDate=${createDate}`,
	...(description ? [`-XMP-dc:Description=${description}`] : []),
	...(subjects.length ? subjects.map((s, i) => i === 0 ? `-XMP-dc:Subject=${s}` : `-XMP-dc:Subject+=${s}`) : []),
	`-XMP-iptcExt:DigitalSourceType=${dstType}`,
	...(aiTool      ? [`-XMP-${ns}:aiTool=${aiTool}`]                 : []),
	...(credit      ? [`-XMP-photoshop:Credit=${credit}`]             : []),
	...(destination ? [`-XMP-${ns}:destination=${destination}`]       : []),
	...(aiPrompt    ? [`-XMP-${ns}:aiPrompt=${aiPrompt}`]             : []),
	file,
]

// ── preview ───────────────────────────────────────────────────────────────────

const displayArg = (arg: string): string => {
	const eq = arg.indexOf('=')
	if (eq === -1 || eq === arg.length - 1) return gray(arg)
	return `${yellow(arg.slice(0, eq + 1))}${green('"' + arg.slice(eq + 1) + '"')}`
}

console.log()
console.log(hr())
console.log(dim(t.previewTitle))
console.log(hr())
const displayArgs = args.filter(a => a !== '-config' && a !== configPath)
console.log(`  ${bold('exiftool')} \\`)
for (let i = 0; i < displayArgs.length - 1; i++) {
	console.log(`    ${displayArg(displayArgs[i])} \\`)
}
console.log(`    ${bold(displayArgs[displayArgs.length - 1])}`)
console.log()

// ── confirmation ─────────────────────────────────────────────────────────────

const confirm = await rl.question(bold(cyan(t.confirm)) + dim(t.confirmHint) + ' ')
rl.close()

if (confirm.trim().toLowerCase() === 'n') {
	console.log()
	console.log(dim(t.cancelled))
	process.exit(0)
}

// ── execute ──────────────────────────────────────────────────────────────────

const result = await spawnAsync('exiftool', args)

console.log()
if (result.code === 0) {
	console.log(green('  ✓ ') + bold(t.success))
	if (result.stdout.trim()) console.log(dim('  ' + result.stdout.trim()))
} else {
	console.error(red('  ✗ ') + bold(t.error))
	console.error(red('  ' + (result.stderr.trim() || result.stdout.trim())))
	process.exit(1)
}
console.log()
