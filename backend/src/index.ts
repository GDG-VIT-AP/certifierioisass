// Hono backend for Cloudflare Workers -- certificate generation, retrieval, and email dispatch
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createPrisma } from './db';

type Bindings = {
    DATABASE_URL: string;
    GMAIL_CLIENT_ID: string;
    GMAIL_CLIENT_SECRET: string;
    GMAIL_REFRESH_TOKEN: string;
    GMAIL_SENDER_EMAIL: string;
    CERT_VIEW_BASE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/*', cors());

app.get('/', (c) => {
    return c.text('backend is running!');
});

app.post('/generate', async (c) => {
    try {
        const prisma = createPrisma(c.env.DATABASE_URL);
        const template = await c.req.json();

        const records = template.participants
            .filter((p: { name?: string }) => p.name)
            .map((p: { name: string; email?: string }) => ({
                cert_id: `CERT-${crypto.randomUUID().substring(0, 8).toUpperCase()}`,
                participant_name: p.name,
                participant_email: p.email ?? null,
                image: template.image,
                image_size: template.image_size,
                event_name: template.event_name,
                type: template.type,
                name_layer: template.name,
                cert_id_layer: template.cert_id,
                cert_qr_layer: template.cert_qr,
            }));

        await prisma.certificate.createMany({ data: records });

        return c.json({
            success: true,
            message: `Saved ${records.length} certificates to the database!`,
            records: records.map((r: { participant_name: string; cert_id: string; participant_email: string | null }) => ({
                name: r.participant_name,
                cert_id: r.cert_id,
                email: r.participant_email,
            })),
        }, 201);
    } catch (error) {
        console.error("Database error:", error);
        return c.json({ success: false, error: "Failed to save to database" }, 500);
    }
});

app.post('/send-emails', async (c) => {
    try {
        const { records, event_name, cert_base_url } = await c.req.json();

        if (!records?.length) {
            return c.json({ success: false, error: "No records provided" }, 400);
        }

        const accessToken = await getGmailAccessToken(
            c.env.GMAIL_CLIENT_ID,
            c.env.GMAIL_CLIENT_SECRET,
            c.env.GMAIL_REFRESH_TOKEN,
        );

        const results: { email: string; status: string }[] = [];

        for (const record of records) {
            if (!record.email) {
                results.push({ email: '', status: 'skipped' });
                continue;
            }

            const viewUrl = `${(cert_base_url || c.env.CERT_VIEW_BASE_URL).replace(/\/$/, '')}/cert/${record.cert_id}`;

            const subject = `Your Certificate for ${event_name}`;
            const body = [
                `Hi ${record.name},`,
                '',
                `Your certificate for "${event_name}" is ready!`,
                '',
                `View and download it here: ${viewUrl}`,
                '',
                `Certificate ID: ${record.cert_id}`,
                '',
                'Best regards,',
                'GDG OnCampus VIT-AP',
            ].join('\n');

            const rawMessage = createRawEmail(
                c.env.GMAIL_SENDER_EMAIL,
                record.email,
                subject,
                body,
            );

            const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ raw: rawMessage }),
            });

            results.push({
                email: record.email,
                status: res.ok ? 'sent' : 'failed',
            });
        }

        const sent = results.filter(r => r.status === 'sent').length;
        const failed = results.filter(r => r.status === 'failed').length;
        const skipped = results.filter(r => r.status === 'skipped').length;

        return c.json({ success: true, sent, failed, skipped, results });
    } catch (error) {
        console.error("Email error:", error);
        return c.json({ success: false, error: "Failed to send emails" }, 500);
    }
});

app.get('/cert/:id', async (c) => {
    const requestedId = c.req.param('id');

    try {
        const prisma = createPrisma(c.env.DATABASE_URL);
        const record = await prisma.certificate.findUnique({
            where: { cert_id: requestedId },
        });

        if (!record) {
            return c.json({ error: "Certificate not found" }, 404);
        }

        return c.json({
            image: record.image,
            image_size: record.image_size,
            event_name: record.event_name,
            type: record.type,
            participant: {
                name: record.participant_name,
                cert_id: record.cert_id,
            },
            name: record.name_layer,
            cert_id: record.cert_id_layer,
            cert_qr: record.cert_qr_layer,
        }, 200);
    } catch (error) {
        console.error("Database fetch error:", error);
        return c.json({ error: "Failed to fetch certificate" }, 500);
    }
});

async function getGmailAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to refresh Gmail token: ${response.status}`);
    }

    const data = await response.json() as { access_token: string };
    return data.access_token;
}

function createRawEmail(from: string, to: string, subject: string, body: string): string {
    const message = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        '',
        body,
    ].join('\r\n');

    return btoa(unescape(encodeURIComponent(message)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export default app;