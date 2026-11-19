import { AdminRepository } from './repository'

export abstract class AdminService {
	/** Thin today; the place for rules such as caching or hiding numbers per role. */
	static stats() {
		return AdminRepository.counts()
	}

	/** Recipients of moderation emails (posts awaiting approval). */
	static adminEmails() {
		return AdminRepository.adminEmails()
	}
}
