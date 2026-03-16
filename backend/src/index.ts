import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from './db';

const app = new Hono();

app.use('/*', cors());

app.get('/', (c) => {
    return c.text('backend is running!');
});

app.post('/generate', async (c) => {
    try {
        const template = await c.req.json();
        const savedRecords = [];

        for (const participant of template.participants) {
            if (!participant.name) continue; 

            const uniqueId = `CERT-${uuidv4().substring(0, 8).toUpperCase()}`;

            
            await prisma.certificate.create({
                data: {
                    cert_id: uniqueId,
                    participant_name: participant.name,
                    participant_email: participant.email,
                    image: template.image,
                    image_size: template.image_size,
                    event_name: template.event_name,
                    type: template.type,
                    name_layer: template.name,
                    cert_id_layer: template.cert_id,
                    cert_qr_layer: template.cert_qr
                }
            });

            savedRecords.push({ name: participant.name, cert_id: uniqueId });
        }

        return c.json({ 
            success: true, 
            message: `Saved ${savedRecords.length} certificates to the database!`,
            records: savedRecords 
        }, 201);

    } catch (error) {
        console.error("Database error:", error);
        return c.json({ success: false, error: "Failed to save to database" }, 500);
    }
});


app.get('/cert/:id', async (c) => {
    const requestedId = c.req.param('id');

    try {
        const record = await prisma.certificate.findUnique({
            where: { cert_id: requestedId },
            cacheStrategy: { swr: 60, ttl: 60 } // caches the result 
        });

        if (!record) {
            return c.json({ error: "Certificate not found" }, 404);
        }

        const responsePayload = {
            image: record.image,
            image_size: record.image_size,
            event_name: record.event_name,
            type: record.type,
            participant: {
                name: record.participant_name,
                cert_id: record.cert_id
            },
            name: record.name_layer,
            cert_id: record.cert_id_layer,
            cert_qr: record.cert_qr_layer
        };

        return c.json(responsePayload, 200);
        
    } catch (error) {
        console.error("Database fetch error:", error);
        return c.json({ error: "Failed to fetch certificate" }, 500);
    }
});

serve({
    fetch: app.fetch,
    port: 5000
}, (info) => {
    console.log(`Hono Server + Prisma is running on http://localhost:${info.port}`);
});