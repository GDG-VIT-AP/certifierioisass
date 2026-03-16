import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { v4 as uuidv4 } from 'uuid';
import { certificatesDB, CertificateRecord } from './db';

const app = new Hono();

app.use('/*', cors());

app.get('/', (c) => {
    return c.text('backend is running!');
});