-- Blog CMS: articles, categories, tags, author bylines, revision history and redirects, plus the
-- "content_manager" staff role (blogs, media, SEO and site copy only; no orders, customers or payments).
-- Statements are separated by "-- ;;" lines (see migrate.js).

-- the role check was declared inline in 002_admin.sql, so its name is Postgres's default
ALTER TABLE staff_users DROP CONSTRAINT IF EXISTS staff_users_role_check
-- ;;
ALTER TABLE staff_users ADD CONSTRAINT staff_users_role_check
  CHECK (role IN ('owner', 'manager', 'support', 'content_manager'))
-- ;;
CREATE TABLE cms_categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  name         text NOT NULL UNIQUE,
  description  text NOT NULL DEFAULT '',
  sort         int NOT NULL DEFAULT 100,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE TABLE cms_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  name        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
)
-- ;;
-- Bylines shown on articles and used in structured data. A byline is a public profile, not a login.
CREATE TABLE cms_authors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  name        text NOT NULL,
  title       text NOT NULL DEFAULT '',          -- e.g. "Nutritionist"
  bio         text NOT NULL DEFAULT '',
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE TABLE cms_posts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 120),
  title               text NOT NULL,
  excerpt             text NOT NULL DEFAULT '',
  content             jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}',   -- editor document (the source)
  content_html        text NOT NULL DEFAULT '',   -- rendered from content by server/cms/render.js; the only HTML served
  featured_image      text,
  featured_image_alt  text NOT NULL DEFAULT '',
  category_id         uuid REFERENCES cms_categories(id) ON DELETE SET NULL,
  author_id           uuid REFERENCES cms_authors(id) ON DELETE SET NULL,
  concern             text,                       -- links to a "Shop by concern" page and its products
  disclaimer          text,                       -- null = the standard "not medical advice" note
  reading_minutes     int NOT NULL DEFAULT 1 CHECK (reading_minutes BETWEEN 1 AND 240),
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  featured            boolean NOT NULL DEFAULT false,
  published_at        timestamptz,                -- when it went (or goes) live
  seo                 jsonb NOT NULL DEFAULT '{}',  -- title, description, focusKeyword, keywords, canonical, robots, og, twitter
  created_by          uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  updated_by          uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),   -- any change (incl. status)
  content_updated_at  timestamptz NOT NULL DEFAULT now(),   -- the "last updated" date readers see
  CHECK (status NOT IN ('scheduled', 'published') OR published_at IS NOT NULL)
)
-- ;;
CREATE INDEX cms_posts_public_idx ON cms_posts (status, published_at DESC)
-- ;;
CREATE INDEX cms_posts_category_idx ON cms_posts (category_id)
-- ;;
CREATE INDEX cms_posts_concern_idx ON cms_posts (concern) WHERE concern IS NOT NULL
-- ;;
CREATE TABLE cms_post_tags (
  post_id  uuid NOT NULL REFERENCES cms_posts(id) ON DELETE CASCADE,
  tag_id   uuid NOT NULL REFERENCES cms_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
)
-- ;;
CREATE INDEX cms_post_tags_tag_idx ON cms_post_tags (tag_id)
-- ;;
-- Full snapshots of a post (fields + content), so any earlier version can be compared and restored.
CREATE TABLE cms_revisions (
  id           bigserial PRIMARY KEY,
  post_id      uuid NOT NULL REFERENCES cms_posts(id) ON DELETE CASCADE,
  snapshot     jsonb NOT NULL,
  reason       text NOT NULL CHECK (reason IN ('import', 'create', 'save', 'autosave', 'publish', 'unpublish', 'schedule', 'archive', 'restore')),
  staff_id     uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  staff_email  text,
  created_at   timestamptz NOT NULL DEFAULT now()
)
-- ;;
CREATE INDEX cms_revisions_post_idx ON cms_revisions (post_id, created_at DESC)
-- ;;
-- Old URL -> new URL (e.g. after a slug change). Paths only, on this site.
CREATE TABLE cms_redirects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_path    text NOT NULL UNIQUE CHECK (from_path ~ '^/[^\s]*$' AND length(from_path) <= 300),
  to_path      text NOT NULL CHECK (to_path ~ '^/[^\s]*$' AND length(to_path) <= 300),
  status_code  int NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302)),
  post_id      uuid REFERENCES cms_posts(id) ON DELETE CASCADE,   -- set for automatic slug-change redirects
  hits         int NOT NULL DEFAULT 0,
  last_hit_at  timestamptz,
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (from_path <> to_path)
)
