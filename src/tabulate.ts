import { th, tr, td, table, tbody, a, b, fragment } from "./html.js"
import { normalisePath } from "./util.js"
import type { LcovEntry, LcovCoverage, ReportOptions } from "./types.js"

export function tabulate(lcov: LcovEntry[], options: ReportOptions): string {
	const head = tr(
		th("File"),
		th("Stmts"),
		th("Branches"),
		th("Funcs"),
		th("Lines"),
		th("Uncovered Lines"),
	)

	const folders: Record<string, LcovEntry[]> = {}
	for (const file of filterAndNormaliseLcov(lcov, options)) {
		const parts = file.file.replace(options.prefix, "").split("/")
		const folder = parts.slice(0, -1).join("/")
		folders[folder] = folders[folder] || []
		folders[folder]!.push(file)
	}

	const rows = Object.keys(folders)
		.sort()
		.reduce<string[]>(
			(acc, key) => [
				...acc,
				toFolder(key),
				...folders[key]!.map((file) => toRow(file, key !== "", options)),
			],
			[],
		)

	return table(tbody(head, ...rows))
}

function filterAndNormaliseLcov(
	lcov: LcovEntry[],
	options: ReportOptions,
): LcovEntry[] {
	return lcov
		.map((file) => ({
			...file,
			file: normalisePath(file.file),
		}))
		.filter((file) => shouldBeIncluded(file.file, options))
}

function shouldBeIncluded(fileName: string, options: ReportOptions): boolean {
	if (!options.shouldFilterChangedFiles) {
		return true
	}
	return (
		options.changedFiles?.includes(fileName.replace(options.prefix, "")) ??
		false
	)
}

function toFolder(path: string): string {
	if (path === "") {
		return ""
	}

	return tr(td({ colspan: 6 }, b(path)))
}

interface StatAccumulator {
	hit: number
	found: number
}

function getStatement(file: LcovEntry): StatAccumulator {
	const { branches, functions, lines } = file

	return [branches, functions, lines].reduce<StatAccumulator>(
		function (acc, curr) {
			if (!curr) {
				return acc
			}

			return {
				hit: acc.hit + curr.hit,
				found: acc.found + curr.found,
			}
		},
		{ hit: 0, found: 0 },
	)
}

function toRow(
	file: LcovEntry,
	indent: boolean,
	options: ReportOptions,
): string {
	return tr(
		td(filename(file, indent, options)),
		td(coveragePercentage(getStatement(file))),
		td(coveragePercentage(file.branches)),
		td(coveragePercentage(file.functions)),
		td(coveragePercentage(file.lines)),
		td(uncovered(file, options)),
	)
}

function filename(
	file: LcovEntry,
	indent: boolean,
	options: ReportOptions,
): string {
	const relative = file.file.replace(options.prefix, "")
	const href = `https://github.com/${options.repository}/blob/${options.commit}/${relative}`
	const parts = relative.split("/")
	const last = parts[parts.length - 1]!
	const space = indent ? "&nbsp; &nbsp;" : ""
	return fragment(space, a({ href }, last))
}

function coveragePercentage(
	item: LcovCoverage | StatAccumulator | undefined,
): string {
	if (!item) {
		return "N/A"
	}

	const value = item.found === 0 ? 100 : (item.hit / item.found) * 100
	const rounded = value.toFixed(2).replace(/\.0*$/, "")

	const wrapper = value === 100 ? fragment : b

	return wrapper(`${rounded}%`)
}

interface LineRange {
	start: number
	end: number
}

function uncovered(file: LcovEntry, options: ReportOptions): string {
	const branches = (file.branches ? file.branches.details : [])
		.filter((branch) => branch.taken === 0)
		.map((branch) => branch.line)

	const lines = (file.lines ? file.lines.details : [])
		.filter((line) => line.hit === 0)
		.map((line) => line.line)

	const all = ranges([...branches, ...lines])

	return all
		.map(function (range: LineRange) {
			const frag =
				range.start === range.end
					? `L${range.start}`
					: `L${range.start}-L${range.end}`
			const relative = file.file.replace(options.prefix, "")
			const href = `https://github.com/${options.repository}/blob/${options.commit}/${relative}#${frag}`
			const text =
				range.start === range.end
					? `${range.start}`
					: `${range.start}&ndash;${range.end}`

			return a({ href }, text)
		})
		.join(", ")
}

function ranges(linenos: number[]): LineRange[] {
	const res: LineRange[] = []

	let last: LineRange | null = null

	linenos.sort((a, b) => a - b).forEach(function (lineno) {
		if (last === null) {
			last = { start: lineno, end: lineno }
			return
		}

		if (last.end + 1 === lineno) {
			last.end = lineno
			return
		}

		res.push(last)
		last = { start: lineno, end: lineno }
	})

	if (last) {
		res.push(last)
	}

	return res
}
