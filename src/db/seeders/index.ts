import { categoriesSeeder } from './categories.seeder'
import { postsSeeder } from './posts.seeder'
import type { Seeder } from './seeder'
import { usersSeeder } from './users.seeder'

/**
 * Seeders in dependency order (like Laravel's DatabaseSeeder).
 * New table → create `<table>.seeder.ts` and add it here.
 */
export const seeders: Seeder[] = [usersSeeder, categoriesSeeder, postsSeeder]
