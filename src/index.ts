import { promises as fs } from "node:fs"
import * as core from "@actions/core"
import * as github from "@actions/github"

import { parse } from "./lcov.js"
import { diff, delta } from "./comment.js"
import { getChangedFiles } from "./get_changes.js"
import { deleteOldComments } from "./delete_old_comments.js"
import { normalisePath } from "./util.js"
import type { ReportOptions } from "./types.js"

const MAX_COMMENT_CHARS = 65536

async function main(): Promise<void> {
	const token = core.getInput("github-token")
	const octokit = github.getOctokit(token)
	const lcovFile = core.getInput("lcov-file") || "./coverage/lcov.info"
	const baseFile = core.getInput("lcov-base")
	const shouldFilterChangedFiles =
		core.getInput("filter-changed-files").toLowerCase() === "true"
	const shouldDeleteOldComments =
		core.getInput("delete-old-comments").toLowerCase() === "true"
	const title = core.getInput("title")
	const shouldExitIfCoverageDecrease =
		core.getInput("exit-if-coverage-decrease").toLowerCase() === "true"
	const covDecreaseThreshold =
		core.getInput("lcov-decrease-threshold") || "0"

	const raw = await fs.readFile(lcovFile, "utf-8").catch(() => null)
	if (!raw) {
		console.info(`No coverage report found at '${lcovFile}', exiting...`)
		process.exit(1)
	}

	const baseRaw =
		baseFile && (await fs.readFile(baseFile, "utf-8").catch(() => null))
	if (baseFile && !baseRaw) {
		console.info(
			`No coverage report found at '${baseFile}', ignoring...`,
		)
	}

	const context = github.context

	const options: ReportOptions = {
		repository: context.payload.repository!.full_name as string,
		prefix: normalisePath(`${process.env.GITHUB_WORKSPACE}/`),
	}

	if (context.eventName === "pull_request") {
		const pr = context.payload.pull_request!
		options.commit = pr.head.sha as string
		options.baseCommit = pr.base.sha as string
		options.head = pr.head.ref as string
		options.base = pr.base.ref as string
	} else if (context.eventName === "push") {
		options.commit = context.payload.after as string
		options.baseCommit = context.payload.before as string
		options.head = context.ref
	}

	options.shouldFilterChangedFiles = shouldFilterChangedFiles
	options.title = title

	if (shouldFilterChangedFiles) {
		options.changedFiles = await getChangedFiles(octokit, options, context)
	}

	const lcov = await parse(raw)
	const baselcov = baseRaw ? await parse(baseRaw) : null
	const newdelta = delta(lcov, baselcov, options)

	const body = diff(lcov, baselcov, options).substring(0, MAX_COMMENT_CHARS)

	if (context.eventName === "pull_request") {
		if (shouldDeleteOldComments) {
			await deleteOldComments(octokit, options, context)
		}

		await octokit.rest.issues.createComment({
			repo: context.repo.repo,
			owner: context.repo.owner,
			issue_number: context.payload.pull_request!.number as number,
			body: body,
		})
	} else if (context.eventName === "push") {
		await octokit.rest.repos.createCommitComment({
			repo: context.repo.repo,
			owner: context.repo.owner,
			commit_sha: options.commit!,
			body: body,
		})
	}

	const threshold = parseFloat(covDecreaseThreshold)
	if (newdelta < -1 * threshold) {
		console.info(
			`Coverage after merging is ${newdelta}% compare with baseline branch. Max coverage decrease should be ${threshold}%`,
		)
		if (shouldExitIfCoverageDecrease) {
			console.info(`Exiting...`)
			process.exit(1)
		}
	}
}

main().catch(function (err: Error) {
	console.log(err)
	core.setFailed(err.message)
})
