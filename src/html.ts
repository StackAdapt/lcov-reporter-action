type HtmlProps = Record<string, string | number>

function tag(name: string) {
	return function (...children: (string | number | HtmlProps)[]): string {
		const first = children[0]
		const hasProps = typeof first === "object" && first !== null && !Array.isArray(first)

		const props = hasProps
			? Object.keys(first as HtmlProps)
					.map((key) => ` ${key}='${(first as HtmlProps)[key]}'`)
					.join("")
			: ""

		const c = hasProps ? children.slice(1) : children

		return `<${name}${props}>${c.join("")}</${name}>`
	}
}

export const details = tag("details")
export const summary = tag("summary")
export const tr = tag("tr")
export const td = tag("td")
export const th = tag("th")
export const b = tag("b")
export const table = tag("table")
export const tbody = tag("tbody")
export const a = tag("a")
export const span = tag("span")
export const h2 = tag("h2")

export function fragment(...children: (string | number)[]): string {
	return children.join("")
}
