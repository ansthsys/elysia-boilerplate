/** UUID v7: random but time ordered, so new rows append to the end of indexes. */
export const newId = (): string => Bun.randomUUIDv7()
