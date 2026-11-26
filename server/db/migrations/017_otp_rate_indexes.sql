-- Sign-in code limits (shop/auth.js) count codes from the last hour across the whole site and per IP,
-- so those counts need an index on created_at instead of scanning the whole table.
-- Statements are separated by "-- ;;" lines (see migrate.js).

CREATE INDEX IF NOT EXISTS otp_codes_created_idx ON otp_codes (created_at)
-- ;;
CREATE INDEX IF NOT EXISTS otp_codes_ip_idx ON otp_codes (ip, created_at)
