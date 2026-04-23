export function normalisePath(file: string): string {
	return file.replace(/\\/g, "/")
}
