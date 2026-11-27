// Blog posts from the CMS (GET /api/blog/*). Only published posts ever come back from these endpoints.
// The list of post summaries is fetched once per page load and shared by the Blogs page, the concern pages
// and the product pages; single articles are fetched when opened (and kept for back/forward navigation).
import { useEffect, useState, useSyncExternalStore } from 'react';

export const BLOGS_URL = '/blogs';
export const blogUrl = (slug) => `${BLOGS_URL}/${slug}`;

let list = null;            // { posts, categories } once loaded
let listError = null;
let loading = null;
const subs = new Set();
const notify = () => subs.forEach((fn) => fn());

async function getJson(url) {
  const res = await fetch(url, { credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Could not load the blogs.'), { status: res.status });
  return data;
}

export function loadBlogList({ retry = false } = {}) {
  if (retry) { loading = null; listError = null; notify(); }
  loading ??= Promise.all([getJson('/api/blog/posts?limit=100'), getJson('/api/blog/categories')])
    .then(([p, c]) => { list = { posts: p.posts, categories: c.categories }; listError = null; notify(); })
    .catch((e) => { listError = e; loading = null; notify(); });
  return loading;
}

const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const snapshot = () => (list ? list : listError ? { error: listError } : null);

/** { posts, categories } | { error } | null while loading. Starts the fetch on first use. */
export function useBlogList() {
  const value = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => { if (!list && !listError) loadBlogList(); }, []);
  return value;
}

const posts = new Map();    // slug -> { post, related } | { redirect }

/** One article: { data, error, loading }. data is { post, related } or { redirect: '/blogs/new-slug' }. */
export function usePost(slug) {
  const [state, setState] = useState(() => ({ data: posts.get(slug) || null, error: null, loading: !posts.has(slug) }));
  useEffect(() => {
    let live = true;
    if (posts.has(slug)) { setState({ data: posts.get(slug), error: null, loading: false }); return undefined; }
    setState({ data: null, error: null, loading: true });
    getJson(`/api/blog/posts/${encodeURIComponent(slug)}`)
      .then((d) => { posts.set(slug, d); if (live) setState({ data: d, error: null, loading: false }); })
      .catch((e) => live && setState({ data: null, error: e, loading: false }));
    return () => { live = false; };
  }, [slug]);
  return state;
}

/** Staff preview of any article (drafts too), by id. Fetched fresh every time; needs a dashboard sign-in. */
export function usePreview(id) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    let live = true;
    setState({ data: null, error: null, loading: true });
    getJson(`/api/admin/cms/posts/${encodeURIComponent(id)}/preview`)
      .then((d) => live && setState({ data: d, error: null, loading: false }))
      .catch((e) => live && setState({ data: null, error: e, loading: false }));
    return () => { live = false; };
  }, [id]);
  return state;
}

/** "6 min read" */
export const readTime = (minutes) => `${Math.max(1, Number(minutes) || 1)} min read`;
