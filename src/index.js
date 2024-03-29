import { promises as fs } from "fs"
import core from "@actions/core"
import { GitHub, context } from "@actions/github"

import { parse } from "./lcov"
import { diff } from "./comment"
import { delta } from "./comment"
import { getChangedFiles } from "./get_changes"
import { deleteOldComments } from "./delete_old_comments"
import { normalisePath } from "./util"

const MAX_COMMENT_CHARS = 65536

async function main() {
	const token = core.getInput("github-token")
	const githubClient = new GitHub(token)
	const lcovFile = core.getInput("lcov-file") || "./coverage/lcov.info"
	const baseFile = core.getInput("lcov-base")
	const shouldFilterChangedFiles =
		core.getInput("filter-changed-files").toLowerCase() === "true"
	const shouldDeleteOldComments =
		core.getInput("delete-old-comments").toLowerCase() === "true"
	const title = core.getInput("title")
	const shouldExitIfCoverageDecrease =
		core.getInput("exit-if-coverage-decrease").toLowerCase() === "true"
	const covDecreaseThreshold = core.getInput("lcov-decrease-threshold") || "0"

	const raw = await fs.readFile(lcovFile, "utf-8").catch(err => null)
	if (!raw) {
		console.info(`No coverage report found at '${lcovFile}', exiting...`)
		process.exit(1)
	}

	const baseRaw =
		baseFile && (await fs.readFile(baseFile, "utf-8").catch(err => null))
	if (baseFile && !baseRaw) {
		console.info(`No coverage report found at '${baseFile}', ignoring...`)
	}

	const options = {
		repository: context.payload.repository.full_name,
		prefix: normalisePath(`${process.env.GITHUB_WORKSPACE}/`),
	}

	if (context.eventName === "pull_request") {
		options.commit = context.payload.pull_request.head.sha
		options.baseCommit = context.payload.pull_request.base.sha
		options.head = context.payload.pull_request.head.ref
		options.base = context.payload.pull_request.base.ref
	} else if (context.eventName === "push") {
		options.commit = context.payload.after
		options.baseCommit = context.payload.before
		options.head = context.ref
	}

	options.shouldFilterChangedFiles = shouldFilterChangedFiles
	options.title = title

	if (shouldFilterChangedFiles) {
		options.changedFiles = await getChangedFiles(githubClient, options, context)
	}

	const lcov = await parse(raw)
	const baselcov = baseRaw && (await parse(baseRaw))
	const newdelta = await delta(lcov, baselcov, options)

	const body = diff(lcov, baselcov, options).substring(0, MAX_COMMENT_CHARS)

	if (context.eventName === "pull_request") {
		if (shouldDeleteOldComments) {
			await deleteOldComments(githubClient, options, context)
		}

		await githubClient.issues.createComment({
			repo: context.repo.repo,
			owner: context.repo.owner,
			issue_number: context.payload.pull_request.number,
			body: body,
		})
	} else if (context.eventName === "push") {
		await githubClient.repos.createCommitComment({
			repo: context.repo.repo,
			owner: context.repo.owner,
			commit_sha: options.commit,
			body: body,
		})
	}

	const threshold = parseFloat(covDecreaseThreshold)
	if (newdelta < -1*threshold) {
		console.info(`Coverage after merging is ${newdelta}% compare with baseline branch. Max coverage decrease should be ${threshold}%`)
		if (shouldExitIfCoverageDecrease) {
			console.info(`Exiting...`)
			process.exit(1)
		}
	}
}

main().catch(function(err) {
	console.log(err)
	core.setFailed(err.message)
})
