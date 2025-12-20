import type { VercelRequest, VercelResponse } from '@vercel/node';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface MockResponse extends Partial<VercelResponse> {
    statusCode: number;
    body: unknown;
}

const loadAuthModule = async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [] });
    vi.doMock('../../lib/db.js', () => ({ query: queryMock }));
    const mod = await import('../../lib/auth.js');
    return { mod, queryMock };
};

describe('lib/auth', () => {
    afterEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        delete process.env.SESSION_TTL_DAYS;
    });

    it('hashes and verifies passwords consistently', async () => {
        const { mod } = await loadAuthModule();
        const hash = await mod.hashPassword('s3cret!');
        expect(hash).not.toBe('s3cret!');
        expect(await mod.verifyPassword('s3cret!', hash)).toBe(true);
        expect(await mod.verifyPassword('wrong', hash)).toBe(false);
    });

    it('creates expiring sessions when TTL is configured', async () => {
        process.env.SESSION_TTL_DAYS = '2';
        const { mod, queryMock } = await loadAuthModule();
        const result = await mod.createSession('user-123');
        expect(queryMock).toHaveBeenCalledTimes(1);
        const [, params] = queryMock.mock.calls[0];
        expect(params[0]).toHaveLength(96);
        expect(params[1]).toBe('user-123');
        expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('requires authorization headers for protected routes', async () => {
        const { mod } = await loadAuthModule();
        const res: MockResponse = {
            statusCode: 200,
            body: null,
            status(code: number) {
                this.statusCode = code;
                return this as unknown as VercelResponse;
            },
            json(payload: unknown) {
                this.body = payload;
                return this as unknown as VercelResponse;
            }
        };
        const req = { headers: {} } as VercelRequest;
        const user = await mod.requireAuth(req, res as unknown as VercelResponse);
        expect(user).toBeNull();
        expect(res.statusCode).toBe(401);
    });

    it('rejects invalid or expired tokens', async () => {
        const { mod, queryMock } = await loadAuthModule();
        queryMock.mockResolvedValueOnce({ rows: [] });
        const res: MockResponse = {
            statusCode: 200,
            body: null,
            status(code: number) {
                this.statusCode = code;
                return this as unknown as VercelResponse;
            },
            json(payload: unknown) {
                this.body = payload;
                return this as unknown as VercelResponse;
            }
        };
        const req = { headers: { authorization: 'Bearer expired-token' } } as unknown as VercelRequest;
        const user = await mod.requireAuth(req, res as unknown as VercelResponse);
        expect(user).toBeNull();
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: 'Invalid or expired session.' });
    });

    it('returns authenticated user for valid tokens', async () => {
        const { mod, queryMock } = await loadAuthModule();
        queryMock.mockResolvedValueOnce({ rows: [{ id: 'u1', username: 'demo' }] });
        const res: MockResponse = {
            statusCode: 200,
            body: null,
            status(code: number) {
                this.statusCode = code;
                return this as unknown as VercelResponse;
            },
            json(payload: unknown) {
                this.body = payload;
                return this as unknown as VercelResponse;
            }
        };
        const req = { headers: { authorization: 'Bearer token-123' } } as unknown as VercelRequest;
        const user = await mod.requireAuth(req, res as unknown as VercelResponse);
        expect(user).toEqual({ id: 'u1', username: 'demo' });
        expect(res.statusCode).toBe(200);
    });
});
