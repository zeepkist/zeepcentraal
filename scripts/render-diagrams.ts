import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { render, supports } from 'pele'

const docsDirectory = join(import.meta.dir, '..', 'docs', 'architecture')
const mermaidDirectory = join(docsDirectory, 'mermaid')
const generatedDirectory = join(docsDirectory, 'generated')
const svgPattern = /!\[[^\]]+\]\(generated\/([^)]+\.svg)\)/g
const themeStyles = `<style>
.pele {
	--pele-bg: #fffcf0;
	--pele-fg: #100f0f;
	--pele-muted: #6f6e69;
	--pele-line: #100f0f;
	--pele-surface: #f2f0e5;
	--pele-surface-alt: #e6e4d9;
	--pele-border: #cecdc3;
	--pele-accent: #205ea6;
	--pele-critical: #af3029;
	--pele-error: #af3029;
	--pele-series-1: #205ea6;
	--pele-series-2: #af5b13;
	--pele-series-3: #3f6f2e;
	--pele-series-4: #af3029;
	--pele-series-5: #176d68;
	--pele-series-6: #806000;
	--pele-series-7: #80527b;
	--pele-series-8: #76513d;
	--pele-title-weight: bold;
	--pele-heading-weight: bold;
	--pele-bold-weight: bold;
	--pele-radius: 4px;
}

@media (prefers-color-scheme: dark) {
	.pele {
		--pele-bg: #100f0f;
		--pele-fg: #cecdc3;
		--pele-muted: #878580;
		--pele-line: #cecdc3;
		--pele-surface: #1c1b1a;
		--pele-surface-alt: #282726;
		--pele-border: #403e3c;
		--pele-accent: #75a7d2;
		--pele-critical: #f07870;
		--pele-error: #f07870;
		--pele-series-1: #75a7d2;
		--pele-series-2: #f0a45c;
		--pele-series-3: #91c879;
		--pele-series-4: #f07870;
		--pele-series-5: #72c5bd;
		--pele-series-6: #e9cf62;
		--pele-series-7: #c69ac2;
		--pele-series-8: #c49a7b;
	}
}
</style>`

function addTheme(svg: string) {
	return svg.replace(/(<svg\b[^>]*>)/, `$1${themeStyles}`)
}

await mkdir(generatedDirectory, { recursive: true })

const diagrams = (await readdir(mermaidDirectory, { withFileTypes: true }))
	.filter((entry) => entry.isFile() && entry.name.endsWith('.mmd'))
	.map((entry) => entry.name)
	.sort()

if (diagrams.length === 0) throw new Error(`No Mermaid sources found in ${mermaidDirectory}`)

let diagramCount = 0
const generatedSvgPaths = new Set<string>()

for (const diagram of diagrams) {
	const source = await readFile(join(mermaidDirectory, diagram), 'utf8')
	const filename = diagram.replace(/\.mmd$/, '.svg')
	if (generatedSvgPaths.has(filename)) throw new Error(`Duplicate SVG path: ${filename}`)
	generatedSvgPaths.add(filename)
	if (!supports(source)) throw new Error(`${diagram}: unsupported Mermaid type`)

	try {
		const result = render(source, { idPrefix: filename.replace(/\.svg$/, '') })
		if (!result.svg.startsWith('<svg')) throw new Error('Pele returned no SVG root')
		await writeFile(join(generatedDirectory, filename), addTheme(result.svg), 'utf8')
	} catch (error) {
		throw new Error(`${diagram}: ${String(error)}`, { cause: error })
	}
	diagramCount += 1
}

const pages = (await readdir(docsDirectory, { withFileTypes: true }))
	.filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
	.map((entry) => entry.name)
	.sort()
const referencedSvgPaths = new Set<string>()

for (const page of pages) {
	const markdown = await readFile(join(docsDirectory, page), 'utf8')
	for (const [, filename] of markdown.matchAll(svgPattern)) {
		if (!filename || !generatedSvgPaths.has(filename)) {
			throw new Error(`${page}: missing Mermaid source for ${filename ?? 'SVG reference'}`)
		}
		referencedSvgPaths.add(filename)
	}
	if (markdown.replace(svgPattern, '').trim()) {
		throw new Error(`${page}: module pages may only import generated SVGs`)
	}
	if (/```mermaid/.test(markdown))
		throw new Error(`${page}: keep Mermaid source in mermaid/*.mmd`)
}

for (const filename of generatedSvgPaths) {
	if (!referencedSvgPaths.has(filename)) throw new Error(`No Markdown page imports ${filename}`)
}

console.log(`Rendered ${diagramCount} diagrams from ${diagrams.length} Mermaid files with Pele.`)
