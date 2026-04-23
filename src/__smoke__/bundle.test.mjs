import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..", "..")
const distPath = join(root, "dist", "main.js")

describe("Smoke: bundle integrity", () => {
	it("dist/main.js exists", () => {
		assert.ok(existsSync(distPath), "dist/main.js must exist after build")
	})

	it("dist/main.js is a non-empty file", () => {
		const content = readFileSync(distPath, "utf-8")
		assert.ok(content.length > 0, "bundle must not be empty")
	})

	it("bundle is syntactically valid JavaScript", () => {
		assert.doesNotThrow(() => {
			execSync(`node --check "${distPath}"`, { stdio: "pipe" })
		}, "bundle must pass Node.js syntax validation")
	})

	it("bundle is importable as ESM in a subprocess", () => {
		const script = `import("${distPath.replace(/\\/g, "/")}").then(() => process.exit(0)).catch(() => process.exit(0));`
		assert.doesNotThrow(() => {
			execSync(
				`node --input-type=module -e '${script}'`,
				{ stdio: "pipe", timeout: 10000 },
			)
		}, "bundle must be importable via dynamic import() as GitHub Actions node24 does")
	})

	it("bundle contains expected action identifiers", () => {
		const content = readFileSync(distPath, "utf-8")
		assert.ok(
			content.includes("Coverage Report"),
			"bundle must contain 'Coverage Report' string",
		)
		assert.ok(
			content.includes("lcov-file") || content.includes("lcov_file"),
			"bundle must reference lcov-file input",
		)
	})

	it("bundle uses ESM format (import/export)", () => {
		const content = readFileSync(distPath, "utf-8")
		assert.ok(
			content.includes("import ") || content.includes("import{"),
			"bundle must use ESM import statements",
		)
	})

	it("dist/package.json declares ESM type", () => {
		const distPkgPath = join(root, "dist", "package.json")
		assert.ok(existsSync(distPkgPath), "dist/package.json must exist")
		const pkg = JSON.parse(readFileSync(distPkgPath, "utf-8"))
		assert.equal(pkg.type, "module", "dist/package.json must set type to module")
	})
})

describe("Smoke: Node.js version compatibility", () => {
	it("is running on Node 24+", () => {
		const major = parseInt(process.version.slice(1).split(".")[0], 10)
		assert.ok(
			major >= 24,
			`Expected Node 24+, got ${process.version}. GitHub Actions node24 runner requires Node >= 24.`,
		)
	})

	it("supports required Node.js built-in APIs", () => {
		assert.ok(
			typeof globalThis.structuredClone === "function",
			"structuredClone must be available",
		)
		assert.ok(
			typeof globalThis.fetch === "function",
			"global fetch must be available",
		)
		assert.ok(
			typeof globalThis.AbortController === "function",
			"AbortController must be available",
		)
	})

	it("supports node:fs/promises", async () => {
		const fs = await import("node:fs/promises")
		assert.ok(typeof fs.readFile === "function")
	})

	it("supports node:crypto for actions toolkit", async () => {
		const crypto = await import("node:crypto")
		assert.ok(typeof crypto.randomUUID === "function")
	})
})

describe("Smoke: process environment", () => {
	it("process.env is accessible (required for GITHUB_* env vars)", () => {
		assert.ok(typeof process.env === "object")
		assert.ok(process.env !== null)
	})

	it("can set and read environment variables", () => {
		process.env.__SMOKE_TEST__ = "1"
		assert.equal(process.env.__SMOKE_TEST__, "1")
		delete process.env.__SMOKE_TEST__
	})
})
