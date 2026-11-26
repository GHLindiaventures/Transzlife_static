-- The Science page is switched off (it redirects to /blogs), so the "Government Recognized &
-- Certified" announcement (seeded in 012 with /science) points to About, where the certifications are.
UPDATE announcements SET link_url = '/about', updated_at = now() WHERE link_url = '/science'
