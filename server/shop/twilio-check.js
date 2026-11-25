// Checks the Twilio setup, and optionally sends a real test.
//   npm run twilio:check                         credentials + services (sends nothing)
//   npm run twilio:check -- --to 98XXXXXXXX      also sends a sign-in code (Verify) or a test SMS
//   npm run twilio:check -- --to 98XXXXXXXX --code 123456     checks the code you received (Verify)
//   npm run twilio:check -- --to 98XXXXXXXX --whatsapp        sends a test WhatsApp message
import { parseArgs } from 'node:util';
import { createTwilio, toE164 } from './twilio.js';

const { values } = parseArgs({ options: { to: { type: 'string' }, code: { type: 'string' }, whatsapp: { type: 'boolean' } } });
const t = createTwilio(process.env, { log: { error: () => {} } });
const mask = (s) => (s ? `${s.slice(0, 4)}…${s.slice(-4)}` : '(not set)');

console.log('Twilio settings');
console.log(`  TWILIO_ACCOUNT_SID           ${mask(process.env.TWILIO_ACCOUNT_SID)}`);
console.log(`  TWILIO_AUTH_TOKEN            ${process.env.TWILIO_AUTH_TOKEN ? 'set' : '(not set)'}`);
console.log(`  TWILIO_VERIFY_SERVICE_SID    ${mask(process.env.TWILIO_VERIFY_SERVICE_SID)}`);
console.log(`  TWILIO_MESSAGING_SERVICE_SID ${mask(process.env.TWILIO_MESSAGING_SERVICE_SID)}`);
console.log(`  TWILIO_PHONE_NUMBER          ${process.env.TWILIO_PHONE_NUMBER || '(not set)'}`);
console.log(`  TWILIO_WHATSAPP_FROM         ${process.env.TWILIO_WHATSAPP_FROM || '(not set)'}`);
console.log(`  ORDER_NOTIFICATIONS          ${process.env.ORDER_NOTIFICATIONS || 'off'}\n`);

const s = await t.status();
if (!s.configured) { console.log('✗ Twilio is not configured: set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env.local'); process.exit(1); }
if (!s.ok) { console.log(`✗ Twilio rejected the settings: ${s.error}${s.twilioCode ? ` (Twilio error ${s.twilioCode})` : ''}`); process.exit(1); }
console.log(`✓ Credentials work: account "${s.account.name}" (${s.account.type}, ${s.account.status})`);
console.log(s.verify ? `✓ Verify service: "${s.verifyService.name}" (${s.verifyService.codeLength}-digit codes) -> used for sign-in codes` : '• No Verify service: sign-in codes will be sent as plain SMS' + (s.sms ? '' : ' (but no sender is set either)'));
console.log(s.sms ? '✓ SMS sender set' : '• No SMS sender (TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER)');
console.log(s.whatsapp ? '✓ WhatsApp sender set' : '• No WhatsApp sender (TWILIO_WHATSAPP_FROM)');

if (!values.to) { console.log('\nAdd --to <mobile> to send a real test.'); process.exit(0); }
const to = toE164(values.to);
try {
  if (values.whatsapp) {
    const r = await t.sendWhatsApp(to, 'TranzLife test message: WhatsApp from the website is working.');
    console.log(`\n✓ WhatsApp message queued to ${to} (SID ${r.sid}, status ${r.status})`);
  } else if (values.code) {
    const ok = await t.checkVerification(to, values.code);
    console.log(ok ? `\n✓ Code accepted by Twilio Verify for ${to}` : `\n✗ Twilio says that code is not right for ${to}`);
  } else if (s.verify) {
    const r = await t.startVerification(to);
    console.log(`\n✓ Sign-in code sent to ${to} by Twilio Verify (status ${r.status}). Check it with: npm run twilio:check -- --to ${values.to} --code <code>`);
  } else {
    const r = await t.sendSms(to, 'TranzLife test message: SMS from the website is working.');
    console.log(`\n✓ SMS queued to ${to} (SID ${r.sid}, status ${r.status})`);
  }
} catch (e) {
  console.log(`\n✗ ${e.message}${e.twilioCode ? ` (Twilio error ${e.twilioCode})` : ''}`);
  process.exit(1);
}
