import type { VercelRequest, VercelResponse } from '@vercel/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/auth/login';

const queryMock = vi.fn();
const createSessionMock = vi.fn();
const verifyPasswordMock = vi.fn();

vi.mock('../../lib/db.js', () => ({
    query: (...args: unknown[]) => queryMock(...args),
    withTransaction: vi.fn()
}));

vi.mock('../../lib/auth.js', () => ({
    createSession: (...args: unknown[]) => createSessionMock(...args),
    verifyPassword: (...args: unknown[]) => verifyPasswordMock(...args)
}));

const createResponse = () => {
    const res: Partial<VercelResponse> & {
        statusCode: number;
        body: unknown;
        headers: Record<string, string>;
    } = {
        statusCode: 200,
        body: null,
        headers: {},
        setHeader(key: string, value: string) {
            this.headers[key] = value;
            return this as unknown as VercelResponse;
        },
        status(code: number) {
            this.statusCode = code;
            return this as unknown as VercelResponse;
        },
        json(payload: unknown) {
            this.body = payload;
            return this as unknown as VercelResponse;
        }
    };
    return res;
};

describe('api/auth/login handler', () => {
    beforeEach(() => {
        queryMock.mockReset();
        createSessionMock.mockReset();
        verifyPasswordMock.mockReset();
    });

    it('rejects unsupported methods', async () => {
        const res = createResponse();
        const req = { method: 'GET', body: null } as unknown as VercelRequest;
        await handler(req, res as unknown as VercelResponse);
        expect(res.statusCode).toBe(405);
        expect(res.headers['Allow']).toBe('POST');
    });

    it('validates request payload', async () => {
        const res = createResponse();
        const req = { method: 'POST', body: {} } as unknown as VercelRequest;
        await handler(req, res as unknown as VercelResponse);
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ error: 'Username and password are required.' });
    });

    it('rejects unknown users', async () => {
        queryMock.mockResolvedValueOnce({ rows: [] });
        const res = createResponse();
        const req = { method: 'POST', body: { username: 'demo', password: 'pw' } } as unknown as VercelRequest;
        await handler(req, res as unknown as VercelResponse);
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: 'Invalid credentials.' });
    });

    it('rejects invalid passwords', async () => {
        queryMock.mockResolvedValueOnce({ rows: [{ id: '1', username: 'demo', password_hash: 'hash' }] });
        verifyPasswordMock.mockResolvedValueOnce(false);
        const res = createResponse();
        const req = { method: 'POST', body: { username: 'demo', password: 'pw' } } as unknown as VercelRequest;
        await handler(req, res as unknown as VercelResponse);
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: 'Invalid credentials.' });
    });

    it('issues tokens for valid credentials', async () => {
        queryMock.mockResolvedValueOnce({ rows: [{ id: '1', username: 'demo', password_hash: 'hash' }] });
        verifyPasswordMock.mockResolvedValueOnce(true);
        createSessionMock.mockResolvedValueOnce({ token: 'abc', expiresAt: null });
        const res = createResponse();
        const req = { method: 'POST', body: { username: 'demo', password: 'pw' } } as unknown as VercelRequest;
        await handler(req, res as unknown as VercelResponse);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ token: 'abc', user: { id: '1', username: 'demo' } });
        expect(createSessionMock).toHaveBeenCalledWith('1');
    });
});
