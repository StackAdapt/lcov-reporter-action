import lcovParse from "lcov-parse"
import type { LcovEntry } from "./types.js"

export function parse(data: string): Promise<LcovEntry[]> {
	return new Promise(function (resolve, reject) {
		lcovParse(data, function (err, res) {
			if (err) {
				reject(new Error(String(err)))
				return
			}
			if (!Array.isArray(res)) {
				resolve([])
				return
			}
			resolve(res as unknown as LcovEntry[])
		})
	})
}

export function percentage(lcov: LcovEntry[]): number {
	let hit = 0
	let found = 0
	for (const entry of lcov) {
		hit += entry.lines.hit
		found += entry.lines.found
	}

	if (found === 0) return 0

	return (hit / found) * 100
}
