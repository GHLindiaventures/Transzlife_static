// Policy pages: id -> [title, [[heading, text], ...]]. Seeded into the database (site_docs "policies"); the website reads the database copy.
import { SITE } from './site.js';

export const POLICIES = {
  shipping: ['Shipping & returns', [
    ['Shipping', `We ship across India. Orders are dispatched within 1 to 2 working days and usually delivered in 3 to 7 working days. Shipping is free on orders above ₹${SITE.freeShippingAbove}; a flat ₹${SITE.shippingFee} fee applies below that.`],
    ['Cash on Delivery', 'COD is available on most pin codes. We may confirm COD orders by phone before dispatch.'],
    ['Damaged or wrong items', 'If your order arrives damaged, leaking or incorrect, please contact us within 48 hours of delivery with photos of the package and product. We will send a replacement or issue a full refund.'],
    ['Returns', 'For hygiene and safety reasons, opened or used products cannot be returned. Unopened products in original packaging may be returned within 7 days of delivery; return shipping may be charged.'],
    ['Refunds', 'Approved refunds are processed to the original payment method within 5 to 7 working days. COD refunds are made by bank transfer or UPI.'],
  ]],
  privacy: ['Privacy policy', [
    ['What we collect', 'When you place an order or contact us, we collect your name, phone number, email, delivery address and order details. Payments are processed by our payment partner; we do not store card details.'],
    ['How we use it', 'To process and deliver orders, provide customer support, and, if you opt in, send cart and refill reminders, wellness tips and offers by SMS or WhatsApp. You can turn reminders off in My account or reply STOP at any time.'],
    ['Site analytics', 'We run our own analytics: no advertising networks, no third-party trackers, and we never store your IP address or fingerprint your device. Without your consent we count page views only, anonymously. If you choose "Accept" in the privacy banner, your browser keeps a random visitor ID so we can tell new from returning visitors, see which products are viewed, added to the cart, saved or shared, and keep your cart so it is not lost. If you are signed in, this activity is linked to your account. Raw activity is deleted after 13 months. You can change your choice any time with "Privacy choices" at the bottom of every page.'],
    ['Reviews', 'Only customers whose order was delivered can review a product. Your review is shown with your first name and the initial of your last name, never your phone number or email. Reviews with links, contact details, medical claims or abusive language are checked by our team before they appear; we never hide a review because it is critical. You can edit your review at any time, and deleting your account removes your reviews.'],
    ['Live visitor counts', 'The "people browsing right now" numbers are real counts of visitors active in the last 90 seconds, worked out on our server and kept only in memory: nothing about this is stored. Small numbers are not shown, and the numbers are never rounded up or made up.'],
    ['Sharing', 'We share only what is necessary with delivery, payment and messaging partners. We never sell your personal data.'],
    ['Your rights', `You can ask us to access, correct or delete your data by writing to ${SITE.email}.`],
  ]],
  terms: ['Terms of use', [
    ['Wellness information', 'Content on this website is for general information and education only. It is not medical advice and should not replace consultation with a qualified healthcare professional.'],
    ['Product use', 'Always read the product label and follow directions and precautions. Our products are not intended to diagnose, treat, cure or prevent any disease.'],
    ['Pricing', 'Prices are in Indian Rupees and include applicable taxes. We may update prices and offers from time to time; the price at checkout applies to your order.'],
    ['Governing law', 'These terms are governed by the laws of India, with courts in Chennai, Tamil Nadu having jurisdiction.'],
  ]],
};
