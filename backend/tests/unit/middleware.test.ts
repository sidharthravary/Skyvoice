import { Request } from 'express';
import { parseCookies, getTokenFromRequest } from '../../src/middleware/auth';
import { validateBody } from '../../src/middleware/validate';
import { chunkText } from '../../src/services/ragService';
import { z } from 'zod';

describe('parseCookies', () => {
  it('parses a standard cookie header', () => {
    expect(parseCookies('a=1; b=hello%20world; skyvoice_token=abc.def.ghi')).toEqual({
      a: '1',
      b: 'hello world',
      skyvoice_token: 'abc.def.ghi',
    });
  });

  it('returns empty object for missing header', () => {
    expect(parseCookies(undefined)).toEqual({});
  });

  it('ignores malformed segments', () => {
    expect(parseCookies('justtext; ok=1')).toEqual({ ok: '1' });
  });
});

describe('getTokenFromRequest', () => {
  const makeReq = (headers: Record<string, string>) => ({ headers } as unknown as Request);

  it('prefers the HttpOnly cookie', () => {
    const req = makeReq({
      cookie: 'skyvoice_token=cookie-token',
      authorization: 'Bearer header-token',
    });
    expect(getTokenFromRequest(req)).toBe('cookie-token');
  });

  it('falls back to the Bearer header', () => {
    const req = makeReq({ authorization: 'Bearer header-token' });
    expect(getTokenFromRequest(req)).toBe('header-token');
  });

  it('returns null when neither is present', () => {
    expect(getTokenFromRequest(makeReq({}))).toBeNull();
  });
});

describe('validateBody', () => {
  const schema = z.object({ name: z.string().min(1), status: z.enum(['a', 'b']).optional() });

  const run = (body: unknown) =>
    new Promise<{ nextArg: unknown; body: unknown }>((resolve) => {
      const req = { body } as Request;
      validateBody(schema)(req, {} as never, (err?: unknown) =>
        resolve({ nextArg: err, body: req.body })
      );
    });

  it('passes valid bodies through', async () => {
    const { nextArg } = await run({ name: 'ok' });
    expect(nextArg).toBeUndefined();
  });

  it('strips unknown keys (mass-assignment protection)', async () => {
    const { nextArg, body } = await run({ name: 'ok', role: 'admin', $where: 'evil' });
    expect(nextArg).toBeUndefined();
    expect(body).toEqual({ name: 'ok' });
  });

  it('rejects invalid bodies with a 400 ApiError', async () => {
    const { nextArg } = await run({ status: 'z' });
    expect(nextArg).toMatchObject({ statusCode: 400 });
  });
});

describe('chunkText', () => {
  it('chunks with overlap', () => {
    const text = 'x'.repeat(1200);
    const chunks = chunkText(text, 500, 100);
    expect(chunks[0]).toHaveLength(500);
    expect(chunks.length).toBe(3);
    // consecutive chunks overlap by 100 chars (step = 400)
    expect(chunks[1]).toHaveLength(500);
  });

  it('returns empty array for empty input', () => {
    expect(chunkText('')).toEqual([]);
  });
});
