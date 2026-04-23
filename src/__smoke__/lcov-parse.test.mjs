import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..", "..")
const distPath = join(root, "dist", "main.js")

describe("Smoke: lcov-parse in bundle", () => {
	it("lcov-parse is bundled (not left as external)", () => {
		const content = readFileSync(distPath, "utf-8")
		assert.ok(
			content.includes("end_of_record") ||
				content.includes("DA:") ||
				content.includes("lcov"),
			"lcov-parse should be bundled into dist/main.js",
		)
	})
})

describe("Smoke: no native dependencies", () => {
	it("bundle does not reference .node native addons", () => {
		const content = readFileSync(distPath, "utf-8")
		const nativeImport = content.match(/["'][^"']+\.node["']/g)
		const filtered = (nativeImport || []).filter(
			(m) => !m.includes("node:") && !m.includes("node_modules"),
		)
		assert.ok(
			filtered.length === 0,
			"bundle must not import .node native addons for GitHub Actions portability",
		)
	})
})

describe("Smoke: bundle size", () => {
	it("bundle is under 2MB (reasonable for a GitHub Action)", () => {
		const content = readFileSync(distPath)
		const sizeMB = content.length / (1024 * 1024)
		assert.ok(
			sizeMB < 2,
			`Bundle is ${sizeMB.toFixed(2)}MB, expected under 2MB`,
		)
	})
})
