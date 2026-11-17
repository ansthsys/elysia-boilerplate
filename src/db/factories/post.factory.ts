import { faker } from '@faker-js/faker'
import { posts } from '../schema'
import { defineFactory } from './factory'

/** `authorId` and `categoryId` have no sensible fake value: always pass them as overrides. */
export const postFactory = defineFactory(posts, () => ({
	title: faker.lorem.sentence({ min: 3, max: 8 }).slice(0, 200),
	content: faker.lorem.paragraphs(3),
	authorId: '',
	categoryId: '',
}))
