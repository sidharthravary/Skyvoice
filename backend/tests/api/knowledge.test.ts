import express from 'express';
import request from 'supertest';
import knowledgeRoutes from '../../src/routes/knowledge';
import { errorHandler } from '../../src/middleware/errorHandler';
import { KnowledgeBase } from '../../src/models/knowledgeBase.model';
import { connectTestDb, disconnectTestDb } from '../helpers/testDb';

let app: express.Express;

beforeAll(async () => {
  await connectTestDb('skyvoice-test-knowledge');
  await KnowledgeBase.init(); // build the text index before $text queries

  app = express();
  app.use(express.json());
  app.use('/api/knowledge', knowledgeRoutes);
  app.use(errorHandler);
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('Knowledge base API', () => {
  it('creates an FAQ with an embedding', async () => {
    const res = await request(app).post('/api/knowledge/faq').send({
      title: 'What is the refund window?',
      content: 'Customers can request a refund within 30 days of purchase.',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.sourceType).toBe('faq');
    expect(res.body.data.indexStatus).toBe('indexed');

    const stored = await KnowledgeBase.findById(res.body.data._id);
    expect(stored?.embedding.length).toBeGreaterThan(0);
  });

  it('rejects an FAQ with missing fields (zod)', async () => {
    const res = await request(app).post('/api/knowledge/faq').send({ title: 'No answer' });
    expect(res.status).toBe(400);
  });

  it('lists entries without exposing embeddings', async () => {
    const res = await request(app).get('/api/knowledge');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].embedding).toBeUndefined();
    expect(res.body.pagination.total).toBeGreaterThan(0);
  });

  it('finds the FAQ via search', async () => {
    const res = await request(app)
      .post('/api/knowledge/search')
      .send({ query: 'refund purchase' });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].title).toContain('refund');
  });

  it('rejects an empty search query (zod)', async () => {
    const res = await request(app).post('/api/knowledge/search').send({ query: '   ' });
    expect(res.status).toBe(400);
  });

  it('deletes an entry', async () => {
    const created = await request(app).post('/api/knowledge/faq').send({
      title: 'Temp question',
      content: 'Temp answer',
    });
    const id = created.body.data._id;

    const del = await request(app).delete(`/api/knowledge/${id}`);
    expect(del.status).toBe(200);
    expect(await KnowledgeBase.findById(id)).toBeNull();
  });
});
