import process from "node:process"
import { promises as fs } from "node:fs"
import path from "node:path"

import { parse } from "./lcov.js"
import { diff } from "./comment.js"
import type { ReportOptions } from "./types.js"

async function main(): Promise<void> {
	const file = process.argv[2]
	const beforeFile = process.argv[3]

	if (!file) {
		console.error("Usage: cli <lcov-file> [lcov-base-file]")
		process.exit(1)
	}

	const prefix = path.dirname(path.dirname(path.resolve(file))) + "/"

	const content = await fs.readFile(file, "utf-8")
	const lcov = await parse(content)

	let before = null
	if (beforeFile) {
		const baseContent = await fs.readFile(beforeFile, "utf-8")
		before = await parse(baseContent)
	}

	const options: ReportOptions = {
		repository: "example/foo",
		commit: "f9d42291812ed03bb197e48050ac38ac6befe4e5",
		prefix,
		head: "feat/test",
		base: "master",
	}

	console.log(diff(lcov, before, options))
}

main().catch(function (err: Error) {
	console.log(err)
	process.exit(1)
})
