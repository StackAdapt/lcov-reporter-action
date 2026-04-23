import * as core from "@actions/core"
import type { OctokitClient, GitHubContext, ReportOptions } from "./types.js"

export async function getChangedFiles(
	githubClient: OctokitClient,
	options: ReportOptions,
	context: GitHubContext,
): Promise<string[]> {
	if (!options.commit || !options.baseCommit) {
		core.setFailed(
			`The base and head commits are missing from the payload for this ${context.eventName} event.`,
		)
	}

	const response = await githubClient.rest.repos.compareCommits({
		base: options.baseCommit!,
		head: options.commit!,
		owner: context.repo.owner,
		repo: context.repo.repo,
	})

	if (response.status !== 200) {
		core.setFailed(
			`The GitHub API for comparing the base and head commits for this ${context.eventName} event returned ${response.status}, expected 200.`,
		)
	}

	return (response.data.files ?? [])
		.filter(
			(file) => file.status === "modified" || file.status === "added",
		)
		.map((file) => file.filename)
}
