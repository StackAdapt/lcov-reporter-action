import {
	details,
	summary,
	b,
	fragment,
	table,
	tbody,
	tr,
	th,
	h2,
} from "./html.js"
import { percentage } from "./lcov.js"
import { tabulate } from "./tabulate.js"
import type { LcovEntry, ReportOptions } from "./types.js"

export function comment(lcov: LcovEntry[], options: ReportOptions): string {
	return fragment(
		options.title ? h2(options.title) : "",
		options.base
			? `Coverage after merging ${b(options.head ?? "")} into ${b(
					options.base,
				)} will be`
			: `Coverage for this commit`,
		table(tbody(tr(th(percentage(lcov).toFixed(2), "%")))),
		"\n\n",
		details(
			summary(
				options.shouldFilterChangedFiles
					? "Coverage Report for Changed Files"
					: "Coverage Report",
			),
			tabulate(lcov, options),
		),
	)
}

export function delta(
	lcov: LcovEntry[],
	before: LcovEntry[] | null,
	_options: ReportOptions,
): number {
	if (!before) {
		return 0
	}

	const pbefore = percentage(before)
	const pafter = percentage(lcov)
	return parseFloat((pafter - pbefore).toFixed(2))
}

export function diff(
	lcov: LcovEntry[],
	before: LcovEntry[] | null,
	options: ReportOptions,
): string {
	if (!before) {
		return comment(lcov, options)
	}

	const pbefore = percentage(before)
	const pafter = percentage(lcov)
	const pdiff = pafter - pbefore
	const plus = pdiff > 0 ? "+" : ""
	const arrow = pdiff === 0 ? "" : pdiff < 0 ? "▾" : "▴"

	return fragment(
		options.title ? h2(options.title) : "",
		options.base
			? `Coverage after merging ${b(options.head ?? "")} into ${b(
					options.base,
				)} will be`
			: `Coverage for this commit`,
		table(
			tbody(
				tr(th("Coverage"), th("Delta")),
				tr(
					th(pafter.toFixed(2), "%"),
					th(arrow, " ", plus, pdiff.toFixed(2), "%"),
				),
			),
		),
		"\n\n",
		details(
			summary(
				options.shouldFilterChangedFiles
					? "Coverage Report for Changed Files"
					: "Coverage Report",
			),
			tabulate(lcov, options),
		),
	)
}
