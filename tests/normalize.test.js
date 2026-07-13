import { describe, expect, it } from "vitest";

// Mirror of server-side norm helpers used by artists/features/api.js
const normId = (o) => o?.idArtist || o?.id || o?._id || o?.artistId || "";

const normGenres = (o) => {
  if (Array.isArray(o?.genres)) return o.genres;
  if (typeof o?.strGenre === "string" && o.strGenre.trim())
    return o.strGenre.split(/,\s*/).filter(Boolean);
  if (o?.genre) return [o.genre];
  return [];
};

const normArtist = (o = {}) => ({
  id: normId(o),
  name: o.strArtist || o.name || "Unknown artist",
  genres: normGenres(o),
});

describe("artist normalize", () => {
  it("maps TheAudioDB fields", () => {
    const a = normArtist({
      idArtist: "111",
      strArtist: "Queen",
      strGenre: "Rock, Progressive Rock",
    });
    expect(a).toEqual({
      id: "111",
      name: "Queen",
      genres: ["Rock", "Progressive Rock"],
    });
  });

  it("falls back for empty objects", () => {
    expect(normArtist({})).toEqual({
      id: "",
      name: "Unknown artist",
      genres: [],
    });
  });
});
