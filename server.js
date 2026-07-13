import express from "express";
import axios from "axios";
import cors from "cors";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const genres = JSON.parse(
  readFileSync(join(__dirname, "data/genres.json"), "utf8")
);
const popularNames = JSON.parse(
  readFileSync(join(__dirname, "data/popular-artists.json"), "utf8")
);

const app = express();

const API_KEY = process.env.AUDIODB_API_KEY || "2";
const BASE_URL = `https://theaudiodb.com/api/v1/json/${API_KEY}`;
const UA = { "User-Agent": "ArtistsHub/1.0" };

const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_ORIGINS;

app.use(
  cors({
    origin(origin, cb) {
      // Same-origin / non-browser / Vercel internal — no Origin header
      if (!origin) return cb(null, true);
      if (corsOrigins.includes("*") || corsOrigins.includes(origin)) {
        return cb(null, true);
      }
      // Allow Vercel preview/production hosts by default
      if (/\.vercel\.app$/i.test(origin)) return cb(null, true);
      return cb(null, false);
    },
  })
);
app.use(express.json({ limit: "32kb" }));

/* ---------- small in-memory TTL cache ---------- */
const cache = new Map();
const POPULAR_TTL = 60 * 60 * 1000;
const ARTIST_TTL = 30 * 60 * 1000;
const ALBUMS_TTL = 30 * 60 * 1000;

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value, ttlMs) {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

async function audioDbGet(path, { timeout = 8000 } = {}) {
  const { data } = await axios.get(`${BASE_URL}/${path}`, {
    headers: UA,
    timeout,
  });
  return data;
}

function firstArtist(data) {
  if (!data?.artists) return null;
  return Array.isArray(data.artists) ? data.artists[0] : data.artists;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/** Parallel map with a concurrency limit */
async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  const n = Math.min(limit, items.length) || 1;
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

async function loadPopularArtists() {
  const cached = getCached("popular-artists");
  if (cached) return cached;

  const found = await mapPool(popularNames, 6, async (name) => {
    try {
      const data = await audioDbGet(`search.php?s=${encodeURIComponent(name)}`, {
        timeout: 4000,
      });
      return firstArtist(data);
    } catch {
      return null;
    }
  });

  const artists = [];
  const seen = new Set();
  for (const a of found) {
    if (!a?.idArtist || seen.has(a.idArtist)) continue;
    seen.add(a.idArtist);
    artists.push(a);
  }

  setCached("popular-artists", artists, POPULAR_TTL);
  return artists;
}

// 📋 Artists list (search / popular pool + filters + pagination)
app.get("/api/artists", async (req, res) => {
  try {
    const { page = 1, limit = 8, name = "", genre = "", sortName = "" } = req.query;
    let artists = [];

    if (name && String(name).trim()) {
      try {
        const data = await audioDbGet(
          `search.php?s=${encodeURIComponent(String(name).trim())}`
        );
        artists = asArray(data?.artists);
      } catch {
        artists = [];
      }
    } else {
      artists = await loadPopularArtists();
    }

    if (sortName === "asc") {
      artists = artists
        .slice()
        .sort((a, b) => (a.strArtist || "").localeCompare(b.strArtist || ""));
    } else if (sortName === "desc") {
      artists = artists
        .slice()
        .sort((a, b) => (b.strArtist || "").localeCompare(a.strArtist || ""));
    }

    if (genre && genre !== "All Genres") {
      const g = String(genre).toLowerCase();
      artists = artists.filter((a) =>
        (a.strGenre || "").toLowerCase().includes(g)
      );
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(40, Math.max(1, parseInt(limit, 10) || 8));
    const offset = (pageNum - 1) * limitNum;

    res.json({
      artists: artists.slice(offset, offset + limitNum),
      totalArtists: artists.length,
      page: pageNum,
      limit: limitNum,
    });
  } catch {
    sendError(res, 500, "Failed to load artists");
  }
});

// 👤 Artist by ID
app.get("/api/artists/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const cacheKey = `artist:${id}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const data = await audioDbGet(`artist.php?i=${encodeURIComponent(id)}`);
    const artist = firstArtist(data);
    if (!artist) return sendError(res, 404, "Artist not found");

    setCached(cacheKey, artist, ARTIST_TTL);
    res.json(artist);
  } catch {
    sendError(res, 500, "Failed to load artist");
  }
});

// 🎵 Albums + tracks (cached, capped, parallel)
app.get("/api/artists/:id/albums", async (req, res) => {
  try {
    const id = String(req.params.id);
    const cacheKey = `albums:${id}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const data = await audioDbGet(`album.php?i=${encodeURIComponent(id)}`);
    const albums = asArray(data?.album).slice(0, 12);

    const albumsWithTracks = await mapPool(albums, 4, async (album) => {
      try {
        const tracksData = await audioDbGet(
          `track.php?m=${encodeURIComponent(album.idAlbum)}`,
          { timeout: 4000 }
        );
        const tracks = asArray(tracksData?.track).map((t) => ({
          title: t.strTrack || "Unknown Track",
          duration: t.intDuration || 0,
          youtube: t.strMusicVid || t.strMusicVidLink || "",
        }));
        return {
          title: album.strAlbum || "Unknown Album",
          tracks,
        };
      } catch {
        return {
          title: album.strAlbum || "Unknown Album",
          tracks: [],
        };
      }
    });

    setCached(cacheKey, albumsWithTracks, ALBUMS_TTL);
    res.json(albumsWithTracks);
  } catch {
    sendError(res, 500, "Failed to load albums");
  }
});

// 🧩 Genres (static)
app.get("/api/genres", (_req, res) => {
  res.json(genres);
});

export default app;

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
