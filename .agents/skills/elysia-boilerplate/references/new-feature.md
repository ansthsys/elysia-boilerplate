# New feature recipe

A complete feature touches every step below. The example builds `tasks`: a resource owned by the signed-in user, with a paginated list and a filter. Rename it and drop what your feature does not need.

Each code block starting with a `// path` comment is a whole new file. Blocks starting with `// edit:` are changes to an existing file.

**Variants:**
- **New endpoint in an existing module:** steps 5–8 and 11 only.
- **Table only (no endpoints):** steps 1–3, plus 9–10 if it needs seed data.

## Checklist

1. Table: `src/db/schema/<feature>.ts`
2. Export it, and add relations
3. Migration: `bun db:generate --name add_<feature> && bun db:migrate`
4. Permissions, if roles other than the owner may act: `src/shared/permissions.ts`
5. Model: `src/modules/<feature>/model.ts`
6. Repository: `src/modules/<feature>/repository.ts`
7. Service: `src/modules/<feature>/service.ts`
8. Controller: `src/modules/<feature>/index.ts`, then register it in `src/app.ts` and add its tag to `src/plugins/openapi.ts`
9. Factory: `src/db/factories/<feature>.factory.ts`
10. Seeder (optional): `src/db/seeders/<feature>.seeder.ts`
11. Test: `test/<feature>.test.ts`
12. `bun run typecheck && bun run lint && bun test`

## 1. Table

```ts
// src/db/schema/tasks.ts
import { timestamps } from '../columns'
import { column, index, table } from '../dialect'
import { users } from './auth'

export const tasks = table(
	'tasks',
	{
		id: column.id(),
		title: column.string('title', 200).notNull(),
		notes: column.text('notes'),
		done: column.boolean('done').notNull().default(false),
		ownerId: column
			.foreignId('owner_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		...timestamps(),
	},
	(t) => [index('tasks_owner_id_idx').on(t.ownerId)],
)

export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
```

- Use `column.string()` for anything unique or indexed. MySQL cannot index `text`.
- Add `.unique()` to a column for a unique constraint.

## 2. Export and relations

```ts
// edit: src/db/schema/index.ts
export * from './tasks'
```

```ts
// edit: src/db/schema/relations.ts
import { tasks } from './tasks'

export const tasksRelations = relations(tasks, ({ one }) => ({
	owner: one(users, { fields: [tasks.ownerId], references: [users.id] }),
}))
// and in usersRelations: tasks: many(tasks),
```

## 3. Migration

```bash
bun db:generate --name add_tasks
bun db:migrate
```

Commit the generated SQL in `drizzle/<driver>/`.

## 4. Permissions (only when someone other than the owner may act)

```ts
// edit: src/shared/permissions.ts
export const statements = {
	...defaultStatements,
	// ...existing resources
	task: ['update', 'delete'], // moderation: act on other users' tasks
} as const

// in roles.admin: task: ['update', 'delete'],
```

## 5. Model

```ts
// src/modules/tasks/model.ts
import { type TSchema, t } from 'elysia'
import { PaginationQuery } from '#core/pagination'
import { tasks } from '#db/schema/index'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from '#db/typebox'
import { paginatedSchema, successSchema } from '#shared'

const refine = {
	title: (column: TSchema) =>
		t.String({ ...column, minLength: 1, error: 'Title must be between 1 and 200 characters' }),
	notes: (column: TSchema) => t.String({ ...column, maxLength: 2000, error: 'Notes must be at most 2,000 characters' }),
}

const insertTask = createInsertSchema(tasks, refine)
const updateTask = createUpdateSchema(tasks, refine)
const selectTask = createSelectSchema(tasks)

const { title, notes, done } = insertTask.properties

export const TaskModel = {
	/** Whitelist: `ownerId` comes from the session, never from the client. */
	create: t.Object({ title, notes: t.Optional(notes), done }),
	update: t.Omit(updateTask, ['id', 'ownerId', 'createdAt', 'updatedAt']),
	params: t.Object({ id: t.String({ format: 'uuid', error: 'Invalid task id' }) }),
	listQuery: t.Object({
		...PaginationQuery.properties,
		done: t.Optional(t.Boolean({ description: 'Filter by completion' })),
	}),
	task: selectTask,
	taskResponse: successSchema(selectTask),
	listResponse: paginatedSchema(selectTask),
	deleteResponse: successSchema(t.Null()),
} as const

export type TaskModel = {
	[K in keyof typeof TaskModel]: (typeof TaskModel)[K]['static']
}
```

## 6. Repository

```ts
// src/modules/tasks/repository.ts
import { and, desc, eq, type SQL } from 'drizzle-orm'
import { db } from '#db/client'
import { newId } from '#db/id'
import { type NewTask, type Task, tasks } from '#db/schema/index'

export interface TaskFilters {
	ownerId: string
	done?: boolean
}

function toWhere(filters: TaskFilters): SQL | undefined {
	const conditions: SQL[] = [eq(tasks.ownerId, filters.ownerId)]
	if (filters.done !== undefined) conditions.push(eq(tasks.done, filters.done))
	return and(...conditions)
}

/** Every Drizzle query of the tasks module. No business rules here. */
export abstract class TaskRepository {
	static findMany(filters: TaskFilters, page: { limit: number; offset: number }): Promise<Task[]> {
		return db.query.tasks.findMany({
			where: toWhere(filters),
			orderBy: [desc(tasks.createdAt), desc(tasks.id)],
			limit: page.limit,
			offset: page.offset,
		})
	}

	static count(filters: TaskFilters): Promise<number> {
		return db.$count(tasks, toWhere(filters))
	}

	static findById(id: string): Promise<Task | undefined> {
		return db.query.tasks.findFirst({ where: eq(tasks.id, id) })
	}

	static async create(values: Omit<NewTask, 'id'>): Promise<string> {
		const id = newId()
		await db.insert(tasks).values({ ...values, id })
		return id
	}

	static async update(id: string, values: Partial<Omit<NewTask, 'id' | 'ownerId'>>): Promise<void> {
		await db.update(tasks).set(values).where(eq(tasks.id, id))
	}

	static async delete(id: string): Promise<void> {
		await db.delete(tasks).where(eq(tasks.id, id))
	}
}
```

- For a column with a unique index, wrap the write in `guardUnique(() => ...)` from `#db/errors`.
- For a referenced row, add an `exists(id)` method; other modules reach it through this module's service.

## 7. Service

```ts
// src/modules/tasks/service.ts
import { type Actor, can } from '#core/access'
import { ForbiddenError, NotFoundError } from '#core/errors'
import { buildPaginationMeta, resolvePagination } from '#shared'
import type { TaskModel } from './model'
import { TaskRepository } from './repository'

/** Business rules for tasks: owners see and change their own tasks; `task:*` permissions moderate. */
export abstract class TaskService {
	static async list(query: TaskModel['listQuery'], actor: Actor) {
		const { page, limit, offset } = resolvePagination(query)
		const filters = { ownerId: actor.id, done: query.done }

		const [items, total] = await Promise.all([
			TaskRepository.findMany(filters, { limit, offset }),
			TaskRepository.count(filters),
		])
		return { items, meta: buildPaginationMeta(page, limit, total) }
	}

	static async findById(id: string, actor: Actor) {
		const task = await TaskRepository.findById(id)
		// Someone else's task is reported as missing, so ids cannot be probed.
		if (!task || (task.ownerId !== actor.id && !can(actor.role, { task: ['update'] }))) {
			throw new NotFoundError('Task')
		}
		return task
	}

	static async create(input: TaskModel['create'], owner: Actor) {
		const id = await TaskRepository.create({ ...input, ownerId: owner.id })
		return TaskService.findById(id, owner)
	}

	static async update(id: string, input: TaskModel['update'], actor: Actor) {
		const task = await TaskService.findById(id, actor) // 404 first
		TaskService.assertCanModify(task.ownerId, actor, 'update') // then 403
		await TaskRepository.update(id, input)
		return TaskService.findById(id, actor)
	}

	static async remove(id: string, actor: Actor) {
		const task = await TaskService.findById(id, actor)
		TaskService.assertCanModify(task.ownerId, actor, 'delete')
		await TaskRepository.delete(id)
	}

	private static assertCanModify(ownerId: string, actor: Actor, action: 'update' | 'delete') {
		if (ownerId === actor.id || can(actor.role, { task: [action] })) return
		throw new ForbiddenError(`You can only ${action} your own tasks`)
	}
}
```

- A foreign id that comes from the body must be validated through the other module's service, e.g. `await CategoryService.assertExists(input.categoryId)`. It returns 422 on that field.
- Duplicates: catch `UniqueConstraintError` and throw `ConflictError` (see `CategoryService`).

## 8. Controller, registration and docs tag

```ts
// src/modules/tasks/index.ts
import { Elysia } from 'elysia'
import { errorResponses, ok, paginated } from '#core/http'
import { authGuard } from '#plugins/auth'
import { errorHandler } from '#plugins/error-handler'
import { TaskModel } from './model'
import { TaskService } from './service'

/** Tasks of the signed-in user. Every route requires a session (`auth` guard). */
export const tasksModule = new Elysia({ prefix: '/api/tasks', detail: { tags: ['Tasks'] } })
	.use(errorHandler)
	.use(authGuard)
	.get(
		'',
		async ({ query, user }) => {
			const { items, meta } = await TaskService.list(query, user)
			return paginated(items, meta)
		},
		{
			auth: true,
			query: TaskModel.listQuery,
			response: { 200: TaskModel.listResponse, ...errorResponses(401, 422) },
			detail: { summary: 'List my tasks' },
		},
	)
	.post('', async ({ body, user, status }) => status(201, ok(await TaskService.create(body, user))), {
		auth: true,
		body: TaskModel.create,
		response: { 201: TaskModel.taskResponse, ...errorResponses(401, 422) },
		detail: { summary: 'Create a task' },
	})
	.guard({ params: TaskModel.params }, (app) =>
		app
			.get('/:id', async ({ params, user }) => ok(await TaskService.findById(params.id, user)), {
				auth: true,
				response: { 200: TaskModel.taskResponse, ...errorResponses(401, 404, 422) },
				detail: { summary: 'Get a task' },
			})
			.patch('/:id', async ({ params, body, user }) => ok(await TaskService.update(params.id, body, user)), {
				auth: true,
				body: TaskModel.update,
				response: { 200: TaskModel.taskResponse, ...errorResponses(401, 403, 404, 422) },
				detail: { summary: 'Update a task' },
			})
			.delete(
				'/:id',
				async ({ params, user }) => {
					await TaskService.remove(params.id, user)
					return ok(null)
				},
				{
					auth: true,
					response: { 200: TaskModel.deleteResponse, ...errorResponses(401, 403, 404, 422) },
					detail: { summary: 'Delete a task' },
				},
			),
	)
```

```ts
// edit: src/app.ts
import { tasksModule } from '#modules/tasks/index'
// ...at the end of the chain, after the other modules:
	.use(tasksModule)
```

```ts
// edit: src/plugins/openapi.ts, in documentation.tags
{ name: 'Tasks', description: 'Tasks of the signed-in user' },
```

Route checklist:
- **Status codes in `errorResponses(...)`:**
  - 401 for guarded routes;
  - 403 when the service can throw `ForbiddenError`;
  - 404 for `:id` routes;
  - 409 for unique fields;
  - 422 whenever there is a body, query or params schema.
- **Public routes:** leave out `auth: true`.
- **Role- or permission-wide rules:** use `role: 'admin'` or `permission: {...}` instead of `auth: true`.

## 9. Factory

```ts
// src/db/factories/task.factory.ts
import { faker } from '@faker-js/faker'
import { tasks } from '../schema'
import { defineFactory } from './factory'

/** `ownerId` has no sensible fake value: always pass it as an override. */
export const taskFactory = defineFactory(tasks, () => ({
	title: faker.lorem.sentence({ min: 2, max: 6 }).slice(0, 200),
	notes: faker.lorem.sentence(),
	done: faker.datatype.boolean(),
	ownerId: '',
}))
```

```ts
// edit: src/db/factories/index.ts
export * from './task.factory'
```

## 10. Seeder (optional)

```ts
// src/db/seeders/tasks.seeder.ts
import { db } from '../client'
import { taskFactory } from '../factories'
import { tasks } from '../schema'
import type { Seeder } from './seeder'

/** Depends on users: register it after `usersSeeder`. Must be safe to run twice. */
export const tasksSeeder: Seeder = {
	name: 'tasks',
	async run() {
		if ((await db.$count(tasks)) > 0) return 'skipped (tasks already exist)'
		const owners = await db.query.users.findMany({ columns: { id: true } })
		for (const owner of owners) await taskFactory.createMany(3, { ownerId: owner.id })
		return `${owners.length * 3} created`
	},
}
```

```ts
// edit: src/db/seeders/index.ts → add tasksSeeder to the `seeders` array, after usersSeeder
```

## 11. Test

```ts
// test/tasks.test.ts
import { describe, expect, it } from 'bun:test'
import { taskFactory } from '#db/factories/index'
import { actingAs, api } from './helpers'

describe('tasks', () => {
	it('creates a task for the signed-in user (201)', async () => {
		const { user, headers } = await actingAs()

		const { data, status } = await api.api.tasks.post({ title: 'Write docs', done: false }, { headers })

		expect(status).toBe(201)
		expect(data?.data).toMatchObject({ title: 'Write docs', done: false, ownerId: user.id, notes: null })
	})

	it('lists only my tasks, paginated and filtered', async () => {
		const me = await actingAs()
		const other = await actingAs()
		await taskFactory.createMany(3, { ownerId: me.user.id, done: true })
		await taskFactory.create({ ownerId: me.user.id, done: false })
		await taskFactory.create({ ownerId: other.user.id, done: true })

		const { data } = await api.api.tasks.get({ query: { done: true, limit: 2 }, headers: me.headers })

		expect(data?.data).toHaveLength(2)
		expect(data?.data.every((task) => task.ownerId === me.user.id && task.done)).toBe(true)
		expect(data?.meta).toMatchObject({ total: 3, nextPage: 2 })
	})

	it('hides other users’ tasks (404) and requires a session (401)', async () => {
		const owner = await actingAs()
		const stranger = await actingAs()
		const task = await taskFactory.create({ ownerId: owner.user.id })

		expect((await api.api.tasks({ id: task.id }).get({ headers: stranger.headers })).status).toBe(404)
		expect((await api.api.tasks.get()).status).toBe(401)
	})

	it('returns field errors (422)', async () => {
		const { headers } = await actingAs()

		const { status, error } = await api.api.tasks.post({ title: '', done: false }, { headers })

		expect(status).toBe(422)
		expect(error?.value.error.details).toEqual([
			{ field: 'title', message: 'Title must be between 1 and 200 characters', location: 'body' },
		])
	})
})
```

Cover at least these cases for a new feature:
- the success path;
- the guard: 401, and 403 when applicable;
- 404;
- one 422 with its `details`;
- every business rule you added: 409, 422 on a foreign id, ownership.
