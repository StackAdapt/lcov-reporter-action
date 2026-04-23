import * as core from "@actions/core"
import type { OctokitClient, GitHubContext, ReportOptions } from "./types.js"

const REQUESTED_COMMENTS_PER_PAGE = 20

export async function deleteOldComments(
	github: OctokitClient,
	options: ReportOptions,
	context: GitHubContext,
): Promise<void> {
	const existingComments = await getExistingComments(
		github,
		options,
		context,
	)
	for (const comment of existingComments) {
		core.debug(`Deleting comment: ${comment.id}`)
		try {
			await github.rest.issues.deleteComment({
				owner: context.repo.owner,
				repo: context.repo.repo,
				comment_id: comment.id,
			})
		} catch (error) {
			console.error(error)
		}
	}
}

interface IssueComment {
	id: number
	body?: string
	user: { login: string } | null
}

async function getExistingComments(
	github: OctokitClient,
	options: ReportOptions,
	context: GitHubContext,
): Promise<IssueComment[]> {
	let page = 0
	let results: IssueComment[] = []
	let response
	do {
		response = await github.rest.issues.listComments({
			issue_number: context.issue.number,
			owner: context.repo.owner,
			repo: context.repo.repo,
			per_page: REQUESTED_COMMENTS_PER_PAGE,
			page: page,
		})
		results = results.concat(response.data as IssueComment[])
		page++
	} while (response.data.length === REQUESTED_COMMENTS_PER_PAGE)

	return results.filter(
		(comment) =>
			!!comment.user &&
			(!options.title || comment.body?.includes(options.title)) &&
			comment.body?.includes("Coverage Report"),
	)
}
