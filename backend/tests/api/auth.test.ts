import express from 'express';
import request from 'supertest';
import authRoutes from '../../src/routes/auth';
import { errorHandler } from '../../src/middleware/errorHandler';
import { connectTestDb, disconnectTestDb } from '../helpers/testDb';

let app: express.Express;

beforeAll(async () => {
  await connectTestDb('skyvoice-test-auth');

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);
});

afterAll(async () => {
  await disconnectTestDb();
});

const visitor = {
  fullName: 'Test Visitor',
  username: 'testvisitor',
  email: 'visitor@example.com',
  password: 'longenough123',
};

describe('POST /api/auth/register', () => {
  it('creates an account, sets an HttpOnly auth cookie, and omits the token from the body', async () => {
    const res = await request(app).post('/api/auth/register').send(visitor);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.role).toBe('visitor');
    expect(res.body.token).toBeUndefined();

    const cookies = res.headers['set-cookie'] as unknown as string[];
    const tokenCookie = cookies.find((c) => c.startsWith('skyvoice_token='));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toMatch(/HttpOnly/i);
    const roleCookie = cookies.find((c) => c.startsWith('skyvoice_role='));
    expect(roleCookie).toBeDefined();
    expect(roleCookie).not.toMatch(/HttpOnly/i);
  });

  it('rejects duplicate usernames with 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...visitor, email: 'other@example.com' });
    expect(res.status).toBe(409);
  });

  it('rejects invalid emails with 400 (zod)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...visitor, username: 'fresh', email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('rejects short passwords with 400 (zod)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...visitor, username: 'fresh2', email: 'f2@example.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('rejects the reserved Admin username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...visitor, username: 'Admin', email: 'a@example.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in an existing user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: visitor.username, password: visitor.password });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe(visitor.username);
    expect(res.body.token).toBeUndefined();
  });

  it('does NOT auto-create accounts for unknown usernames (ghost-account fix)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent-user', password: 'whatever123' });
    expect(res.status).toBe(401);

    // …and a second attempt still fails, proving nothing was created
    const again = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent-user', password: 'whatever123' });
    expect(again.status).toBe(401);
  });

  it('rejects a wrong password with the same message as an unknown user', async () => {
    const wrongPw = await request(app)
      .post('/api/auth/login')
      .send({ username: visitor.username, password: 'incorrect-pass' });
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent-user', password: 'whatever123' });

    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPw.body.error).toEqual(unknown.body.error);
  });

  it('rejects missing fields with 400 (zod)', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('authenticates via the cookie set at login', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: visitor.username, password: visitor.password });
    const cookies = login.headers['set-cookie'] as unknown as string[];

    const res = await request(app).get('/api/auth/me').set('Cookie', cookies.join('; '));
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe(visitor.username);
  });

  it('returns 401 without credentials', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('expires the auth cookies', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const tokenCookie = cookies.find((c) => c.startsWith('skyvoice_token='));
    expect(tokenCookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
