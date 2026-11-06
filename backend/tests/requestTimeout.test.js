import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requestTimeout } from '../src/middleware/requestTimeout.js';

describe('request timeout middleware', () => {
  it('returns a server-side 504 when a route does not respond before its deadline', async () => {
    const app = express();
    app.use(requestTimeout(10));
    app.get('/slow', (_req, _res) => {});

    const response = await request(app).get('/slow');

    expect(response.status).toBe(504);
    expect(response.body).toEqual({
      success: false,
      message: 'The server took too long to respond',
    });
  });

  it('does not replace a response that completes before the deadline', async () => {
    const app = express();
    app.use(requestTimeout(1_000));
    app.get('/fast', (_req, res) => res.json({ success: true }));

    const response = await request(app).get('/fast');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });
});
