import { faker } from '@faker-js/faker'
import { categories } from '../schema'
import { defineFactory } from './factory'

export const categoryFactory = defineFactory(categories, () => {
	const name = `${faker.commerce.department()} ${faker.string.alphanumeric(6)}`
	return {
		name,
		slug: faker.helpers.slugify(name).toLowerCase(),
		description: faker.lorem.sentence(),
	}
})
