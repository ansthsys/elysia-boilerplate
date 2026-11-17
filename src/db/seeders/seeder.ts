/**
 * One seeder per table (or per group of related rows).
 * `run` must be safe to execute more than once.
 */
export interface Seeder {
	name: string
	run: () => Promise<string | undefined>
}
