/** Extract a YouTube video ID from a bare ID or common URL forms. */
export function getYouTubeId(urlOrId) {
  if (!urlOrId) return "";
  if (/^[\w-]{11}$/.test(urlOrId)) return urlOrId;

  try {
    const base =
      typeof location !== "undefined" && location.href
        ? location.href
        : "https://www.youtube.com/";
    const u = new URL(urlOrId, base);
    if (/youtu\.be$/i.test(u.hostname)) return u.pathname.slice(1).split("/")[0];
    const v = u.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/\/(?:embed|v|shorts)\/([^/?#]+)/i);
    if (m?.[1] && /^[\w-]{11}$/.test(m[1])) return m[1];
  } catch {
    /* ignore */
  }
  return "";
}
