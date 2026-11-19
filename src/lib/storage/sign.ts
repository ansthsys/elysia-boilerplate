import { timingSafeEqual } from 'node:crypto'
import { env } from '#config/env'

/**
 * HMAC for local signed URLs. Web Crypto is async; `Bun.CryptoHasher` with a
 * key is synchronous HMAC-SHA256, so `signedUrl()` can stay a plain function.
 */
const secret = () => env.STORAGE_SIGNING_SECRET || env.BETTER_AUTH_SECRET

export const signStorageKey = (key: string, expiresAt: number) =>
	new Bun.CryptoHasher('sha256', secret()).update(`${key}:${expiresAt}`).digest('hex')

/** Constant-time check plus expiry; a malformed signature is simply invalid. */
export function verifyStorageKey(key: string, expiresAt: number, signature: string): boolean {
	if (!Number.isInteger(expiresAt) || expiresAt * 1000 <= Date.now()) return false

	const expected = Buffer.from(signStorageKey(key, expiresAt), 'hex')
	const received = Buffer.from(signature, 'hex')
	return expected.length === received.length && timingSafeEqual(expected, received)
}
