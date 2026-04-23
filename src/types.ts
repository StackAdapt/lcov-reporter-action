import type { getOctokit, context } from "@actions/github"

export type OctokitClient = ReturnType<typeof getOctokit>

export type GitHubContext = typeof context

export interface LcovDetailLine {
	line: number
	hit: number
}

export interface LcovDetailBranch {
	line: number
	block: number
	branch: number
	taken: number
}

export interface LcovDetailFunction {
	name: string
	line: number
}

export interface LcovCoverage {
	found: number
	hit: number
	details: LcovDetailLine[]
}

export interface LcovBranchCoverage {
	found: number
	hit: number
	details: LcovDetailBranch[]
}

export interface LcovFunctionCoverage {
	found: number
	hit: number
	details: LcovDetailFunction[]
}

export interface LcovEntry {
	title: string
	file: string
	lines: LcovCoverage
	functions: LcovFunctionCoverage
	branches: LcovBranchCoverage
}

export interface ReportOptions {
	repository: string
	prefix: string
	commit?: string
	baseCommit?: string
	head?: string
	base?: string
	shouldFilterChangedFiles?: boolean
	changedFiles?: string[]
	title?: string
}
