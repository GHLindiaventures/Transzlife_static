// Contact form and newsletter sign-up (Fastify plugin).
//
//   POST /api/contact      { name, email, phone, topic?, product?, city?, method?, message?, consent, website? }
//   POST /api/newsletter   { email, source?, website? }
//
// Validated on the server with zod (lengths, formats), rate limited per IP, and protected by a
// honeypot field ("website"): real visitors never see or fill it, bots usually do. A filled
// honeypot gets the same "ok" answer so bots learn nothing, but nothing is stored.
import { z } from 'zod';

const text = (max) => z.string().trim().max(max).optional().default('');
const email = z.string().trim().toLowerCase().email('Please enter a valid email address.').max(120);

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name.').max(80),
  email,
  phone: z.string().trim().transform((s) => s.replace(/[\s-]/g, '').replace(/^(\+91|0)/, ''))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Please enter a 10-digit mobile number.')),
  topic: text(80),
  product: text(120),
  city: text(60),
  method: text(20),
  message: text(1500),
  consent: z.literal(true, { message: 'Please accept the Privacy Policy so we can contact you.' }),
  website: z.string().max(200).optional(),          // honeypot
});

const newsletterSchema = z.object({
  email,
  source: z.enum(['footer', 'home']).optional().default('footer'),
  website: z.string().max(200).optional(),          // honeypot
});

function parse(schema, data, reply) {
  const r = schema.safeParse(data ?? {});
  if (r.success) return r.data;
  reply.code(400).send({ error: r.error.issues[0]?.message || 'Please check the form and try again.', code: 'invalid' });
  return null;
}

export default async function enquiryRoutes(app, { db, log }) {
  // a person sends a few enquiries at most; bots hammer
  const limit = (max, minutes) => ({ config: { rateLimit: { max, timeWindow: `${minutes} minutes` } } });

  app.post('/api/contact', limit(5, 60), async (req, reply) => {
    const b = parse(contactSchema, req.body, reply); if (!b) return;
    if (b.website) return { ok: true };            // honeypot filled: pretend it worked
    await db.query(
      `INSERT INTO contact_messages (name, email, phone, topic, product, city, method, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [b.name, b.email, b.phone, b.topic, b.product, b.city, b.method, b.message],
    );
    log?.info?.({ topic: b.topic }, 'contact enquiry received');
    return { ok: true };
  });

  app.post('/api/newsletter', limit(5, 60), async (req, reply) => {
    const b = parse(newsletterSchema, req.body, reply); if (!b) return;
    if (b.website) return { ok: true };
    // signing up again re-subscribes; an existing address is not an error (and is not revealed)
    await db.query(
      `INSERT INTO newsletter_subscribers (email, source) VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET unsubscribed_at = NULL`,
      [b.email, b.source],
    );
    return { ok: true };
  });
}
