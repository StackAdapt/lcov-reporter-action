import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { parse, percentage } from "./lcov.js"
import { comment, diff, delta } from "./comment.js"
import { tabulate } from "./tabulate.js"
import type { ReportOptions } from "./types.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) =>
	readFileSync(join(__dirname, "__fixtures__", name), "utf-8")

const OPTIONS: ReportOptions = {
	repository: "stackadapt/email-orchestration",
	commit: "abc1234def5678",
	baseCommit: "000aaa111bbb",
	head: "feat/improve-coverage",
	base: "main",
	prefix: "/home/runner/work/email-orchestration/email-orchestration/",
}

describe("integration: real lcov parsing", () => {
	it("parses a real multi-file Go lcov without errors", async () => {
		const lcov = await parse(fixture("real.lcov"))
		expect(lcov.length).toBe(7)
	})

	it("extracts correct file paths from real lcov", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const files = lcov.map((e) => e.file)
		expect(files).toContain(
			"internal/common/utils/recovery/recovery.go",
		)
		expect(files).toContain("internal/utils/chunk/chunk.go")
		expect(files).toContain("internal/worker/worker.go")
		expect(files).toContain("internal/worker/base_worker.go")
		expect(files).toContain("internal/reputation/reputation.go")
		expect(files).toContain(
			"internal/db/chunk_drop_off_event_log/model.go",
		)
		expect(files).toContain("internal/db/event_logs/model.go")
	})

	it("computes correct line counts per file", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const byFile = Object.fromEntries(
			lcov.map((e) => [e.file, e.lines]),
		)

		expect(byFile["internal/common/utils/recovery/recovery.go"]).toEqual(
			expect.objectContaining({ found: 10, hit: 10 }),
		)
		expect(
			byFile["internal/db/chunk_drop_off_event_log/model.go"],
		).toEqual(expect.objectContaining({ found: 41, hit: 0 }))
		expect(byFile["internal/utils/chunk/chunk.go"]).toEqual(
			expect.objectContaining({ found: 14, hit: 13 }),
		)
		expect(byFile["internal/worker/base_worker.go"]).toEqual(
			expect.objectContaining({ found: 20, hit: 20 }),
		)
	})

	it("computes correct overall percentage", async () => {
		const lcov = await parse(fixture("real.lcov"))
		// total: LH=90 LF=139
		const pct = percentage(lcov)
		expect(pct).toBeCloseTo(64.75, 1)
	})
})

describe("integration: tabulate with real lcov", () => {
	it("generates a table containing all file entries", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const html = tabulate(lcov, { ...OPTIONS, prefix: "" })

		expect(html).toContain("<table>")
		expect(html).toContain("recovery.go")
		expect(html).toContain("model.go")
		expect(html).toContain("chunk.go")
		expect(html).toContain("worker.go")
		expect(html).toContain("base_worker.go")
		expect(html).toContain("reputation.go")
	})

	it("links files to the correct GitHub blob URL", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const html = tabulate(lcov, { ...OPTIONS, prefix: "" })

		expect(html).toContain(
			`https://github.com/${OPTIONS.repository}/blob/${OPTIONS.commit}/internal/utils/chunk/chunk.go`,
		)
	})

	it("shows 100% for fully-covered files without bold", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const html = tabulate(lcov, { ...OPTIONS, prefix: "" })

		// recovery.go has 10/10 → 100%, should not be wrapped in <b>
		expect(html).toMatch(/recovery\.go.*?100%/)
		expect(html).not.toMatch(/recovery\.go.*?<b>100%<\/b>/)
	})

	it("shows bold for partially-covered files", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const html = tabulate(lcov, { ...OPTIONS, prefix: "" })

		// chunk.go has 13/14 lines → 92.86% should be bold
		expect(html).toMatch(/chunk\.go.*?<b>92\.86%<\/b>/)
	})

	it("shows 0% for completely uncovered files", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const html = tabulate(lcov, { ...OPTIONS, prefix: "" })

		// model.go in chunk_drop_off has 0/41 → 0%
		expect(html).toContain("<b>0%</b>")
	})

	it("lists uncovered lines for partially-covered files", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const html = tabulate(lcov, { ...OPTIONS, prefix: "" })

		// chunk.go line 7 is uncovered
		expect(html).toMatch(/chunk\.go#L7['"]/)
	})
})

describe("integration: comment without baseline", () => {
	it("generates a standalone coverage comment", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const body = comment(lcov, OPTIONS)

		expect(body).toContain("Coverage after merging")
		expect(body).toContain(
			`<b>${OPTIONS.head}</b>`,
		)
		expect(body).toContain(`<b>${OPTIONS.base}</b>`)
		expect(body).toContain("64.75%")
		expect(body).toContain("Coverage Report")
		expect(body).toContain("<table>")
	})

	it("omits merge text when base is not set", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const body = comment(lcov, { ...OPTIONS, base: undefined })

		expect(body).toContain("Coverage for this commit")
		expect(body).not.toContain("Coverage after merging")
	})

	it("includes title when provided", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const body = comment(lcov, {
			...OPTIONS,
			title: "Email Orchestration Coverage",
		})

		expect(body).toContain(
			"<h2>Email Orchestration Coverage</h2>",
		)
	})
})

describe("integration: coverage increased compared to baseline", () => {
	it("delta is positive when current coverage > baseline", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const baseline = await parse(fixture("baseline-worse.lcov"))

		// real: 90/139 ≈ 64.75%, baseline-worse: 59/139 ≈ 42.45%
		expect(percentage(lcov)).toBeGreaterThan(percentage(baseline))

		const d = delta(lcov, baseline, OPTIONS)
		expect(d).toBeGreaterThan(0)
	})

	it("diff output shows upward arrow and positive delta", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const baseline = await parse(fixture("baseline-worse.lcov"))

		const body = diff(lcov, baseline, OPTIONS)

		expect(body).toContain("▴")
		expect(body).toContain("+")
		expect(body).toContain("Coverage after merging")
		expect(body).toContain("Delta")
		expect(body).toContain("<table>")
		expect(body).toContain("Coverage Report")
	})

	it("diff output contains the correct coverage percentages", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const baseline = await parse(fixture("baseline-worse.lcov"))

		const body = diff(lcov, baseline, OPTIONS)
		const pctAfter = percentage(lcov).toFixed(2)

		expect(body).toContain(`${pctAfter}%`)
	})
})

describe("integration: coverage decreased compared to baseline", () => {
	it("delta is negative when current coverage < baseline", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const baseline = await parse(fixture("baseline-better.lcov"))

		// real: 90/139 ≈ 64.75%, baseline-better: 139/139 = 100%
		expect(percentage(lcov)).toBeLessThan(percentage(baseline))

		const d = delta(lcov, baseline, OPTIONS)
		expect(d).toBeLessThan(0)
	})

	it("diff output shows downward arrow and negative delta", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const baseline = await parse(fixture("baseline-better.lcov"))

		const body = diff(lcov, baseline, OPTIONS)

		expect(body).toContain("▾")
		expect(body).toMatch(/▾\s*-?\d+\.\d+%/)
		expect(body).toContain("Delta")
	})

	it("diff output contains correct current and delta percentages", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const baseline = await parse(fixture("baseline-better.lcov"))

		const pctAfter = percentage(lcov)
		const pctBefore = percentage(baseline)
		const expectedDelta = (pctAfter - pctBefore).toFixed(2)

		const body = diff(lcov, baseline, OPTIONS)

		expect(body).toContain(`${pctAfter.toFixed(2)}%`)
		expect(body).toContain(`${expectedDelta}%`)
	})

	it("delta value matches the exact difference", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const baseline = await parse(fixture("baseline-better.lcov"))

		const d = delta(lcov, baseline, OPTIONS)
		const expected = percentage(lcov) - percentage(baseline)

		expect(d).toBeCloseTo(expected, 1)
	})
})

describe("integration: diff with filter-changed-files", () => {
	it("only includes changed files in the report table", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const baseline = await parse(fixture("baseline-worse.lcov"))

		const body = diff(lcov, baseline, {
			...OPTIONS,
			prefix: "",
			shouldFilterChangedFiles: true,
			changedFiles: ["internal/utils/chunk/chunk.go"],
		})

		expect(body).toContain("chunk.go")
		expect(body).toContain("Coverage Report for Changed Files")
		expect(body).not.toContain("recovery.go")
		expect(body).not.toContain("reputation.go")
	})
})

describe("integration: percentage edge cases", () => {
	it("returns 0 for an empty lcov array", () => {
		expect(percentage([])).toBe(0)
	})
})

describe("integration: edge cases with real data", () => {
	it("handles diff when baseline is null", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const body = diff(lcov, null, OPTIONS)

		expect(body).toContain("64.75%")
		expect(body).not.toContain("Delta")
		expect(body).not.toContain("▴")
		expect(body).not.toContain("▾")
	})

	it("delta returns 0 when baseline is null", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const d = delta(lcov, null, OPTIONS)
		expect(d).toBe(0)
	})

	it("handles identical coverage (zero delta)", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const same = await parse(fixture("real.lcov"))

		const d = delta(lcov, same, OPTIONS)
		expect(d).toBe(0)

		const body = diff(lcov, same, OPTIONS)
		expect(body).not.toContain("▴")
		expect(body).not.toContain("▾")
		expect(body).toContain("0.00%")
	})

	it("comment output fits within GitHub comment size limit", async () => {
		const lcov = await parse(fixture("real.lcov"))
		const body = diff(lcov, null, OPTIONS)
		expect(body.length).toBeLessThan(65536)
	})
})
