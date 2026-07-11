import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const API_KEY = "2"; // безкоштовний ключ TheAudioDB
const BASE_URL = "https://theaudiodb.com/api/v1/json";

// 🔍 Пошук артиста за ім'ям
app.get("/api/artist/:name", async (req, res) => {
  try {
    const name = req.params.name;
    const response = await axios.get(`${BASE_URL}/${API_KEY}/search.php?s=${encodeURIComponent(name)}`, {
      headers: { "User-Agent": "MyMusicApp/1.0" }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Помилка запиту", message: error.message });
  }
});

// 🎵 Треки артиста за ID
app.get("/api/tracks/:artistId", async (req, res) => {
  try {
    const id = req.params.artistId;
    const response = await axios.get(`${BASE_URL}/${API_KEY}/track.php?i=${id}`, {
      headers: { "User-Agent": "MyMusicApp/1.0" }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Помилка запиту", message: error.message });
  }
});

// 🎵 Альбоми артиста за ID
app.get("/api/albums/:artistId", async (req, res) => {
  try {
    const id = req.params.artistId;
    const response = await axios.get(`${BASE_URL}/${API_KEY}/album.php?i=${id}`, {
      headers: { "User-Agent": "MyMusicApp/1.0" }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Помилка запиту", message: error.message });
  }
});

// 📋 Список артистів (з пошуком, пагінацією, фільтрами)
app.get("/api/artists", async (req, res) => {
  try {
    const { page = 1, limit = 8, name = "", genre = "", sortName = "" } = req.query;
    
    // TheAudioDB не підтримує прямий пошук списку артистів
    // Використовуємо популярних артистів або пошук за ім'ям
    let artists = [];
    
    if (name && name.trim()) {
      // Пошук за ім'ям
      try {
        const searchResponse = await axios.get(`${BASE_URL}/${API_KEY}/search.php?s=${encodeURIComponent(name)}`, {
          headers: { "User-Agent": "MyMusicApp/1.0" }
        });
        
        if (searchResponse.data && searchResponse.data.artists) {
          artists = Array.isArray(searchResponse.data.artists) 
            ? searchResponse.data.artists 
            : [searchResponse.data.artists];
        }
      } catch (err) {
        console.error("Search error:", err.message);
      }
    } else {
      // Без пошуку - використовуємо популярних артистів
      // TheAudioDB не має прямого endpoint для списку популярних, тому використовуємо пошук популярних імен
      const popularNames = [
        "The Beatles", "Queen", "Pink Floyd", "Led Zeppelin", 
        "Radiohead", "The Rolling Stones", "Nirvana", "Metallica",
        "AC/DC", "U2", "Coldplay", "Red Hot Chili Peppers"
      ];
      
      for (const artistName of popularNames.slice(0, limit * 2)) {
        try {
          const response = await axios.get(`${BASE_URL}/${API_KEY}/search.php?s=${encodeURIComponent(artistName)}`, {
            headers: { "User-Agent": "MyMusicApp/1.0" },
            timeout: 3000
          });
          
          if (response.data && response.data.artists) {
            const found = Array.isArray(response.data.artists) 
              ? response.data.artists[0] 
              : response.data.artists;
            if (found && !artists.find(a => a.idArtist === found.idArtist)) {
              artists.push(found);
            }
          }
          
          // Невелика затримка щоб не перевищити rate limit
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          // Пропускаємо помилки
        }
      }
    }
    
    // Сортування
    if (sortName === "asc") {
      artists.sort((a, b) => (a.strArtist || "").localeCompare(b.strArtist || ""));
    } else if (sortName === "desc") {
      artists.sort((a, b) => (b.strArtist || "").localeCompare(a.strArtist || ""));
    }
    
    // Фільтрація по жанру (якщо TheAudioDB повертає жанр)
    if (genre && genre !== "All Genres") {
      artists = artists.filter(a => 
        (a.strGenre || "").toLowerCase().includes(genre.toLowerCase())
      );
    }
    
    // Пагінація
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 8;
    const offset = (pageNum - 1) * limitNum;
    const paginatedArtists = artists.slice(offset, offset + limitNum);
    
    res.json({
      artists: paginatedArtists,
      totalArtists: artists.length,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    res.status(500).json({ error: "Помилка запиту", message: error.message });
  }
});

// 👤 Отримати одного артиста за ID
app.get("/api/artists/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const response = await axios.get(`${BASE_URL}/${API_KEY}/artist.php?i=${id}`, {
      headers: { "User-Agent": "MyMusicApp/1.0" }
    });
    
    const artist = response.data && response.data.artists 
      ? (Array.isArray(response.data.artists) ? response.data.artists[0] : response.data.artists)
      : null;
    
    res.json(artist || { error: "Артист не знайдено" });
  } catch (error) {
    res.status(500).json({ error: "Помилка запиту", message: error.message });
  }
});

// 🎵 Альбоми артиста за ID (для /api/artists/:id/albums)
app.get("/api/artists/:id/albums", async (req, res) => {
  try {
    const id = req.params.id;
    const response = await axios.get(`${BASE_URL}/${API_KEY}/album.php?i=${id}`, {
      headers: { "User-Agent": "MyMusicApp/1.0" }
    });
    
    let albums = [];
    if (response.data && response.data.album) {
      albums = Array.isArray(response.data.album) 
        ? response.data.album 
        : [response.data.album];
    }
    
    // Отримуємо треки для кожного альбому
    const albumsWithTracks = await Promise.all(
      albums.map(async (album) => {
        try {
          const tracksResponse = await axios.get(`${BASE_URL}/${API_KEY}/track.php?m=${album.idAlbum}`, {
            headers: { "User-Agent": "MyMusicApp/1.0" },
            timeout: 3000
          });
          
          let tracks = [];
          if (tracksResponse.data && tracksResponse.data.track) {
            tracks = Array.isArray(tracksResponse.data.track)
              ? tracksResponse.data.track
              : [tracksResponse.data.track];
          }
          
          return {
            title: album.strAlbum || "Unknown Album",
            tracks: tracks.map(t => ({
              title: t.strTrack || "Unknown Track",
              duration: t.intDuration || 0,
              youtube: t.strMusicVid || t.strMusicVidLink || ""
            }))
          };
        } catch (err) {
          return {
            title: album.strAlbum || "Unknown Album",
            tracks: []
          };
        }
      })
    );
    
    res.json(albumsWithTracks);
  } catch (error) {
    res.status(500).json({ error: "Помилка запиту", message: error.message });
  }
});

// 🧩 Список жанрів
app.get("/api/genres", async (req, res) => {
  try {
    // TheAudioDB не має прямого endpoint для жанрів
    // Повертаємо популярні жанри
    const genres = [
      "All Genres",
      "Rock",
      "Pop",
      "Jazz",
      "Electronic",
      "Hip-Hop",
      "Metal",
      "Country",
      "Blues",
      "R&B",
      "Classical",
      "Reggae",
      "Folk",
      "Punk"
    ];
    
    res.json(genres);
  } catch (error) {
    res.status(500).json({ error: "Помилка запиту", message: error.message });
  }
});

// 💬 Feedbacks (коментарі) - in-memory storage
let feedbacks = [];

// Отримати всі feedbacks
app.get("/api/feedbacks", (req, res) => {
  try {
    res.json({ data: feedbacks });
  } catch (error) {
    res.status(500).json({ error: "Помилка запиту", message: error.message });
  }
});

// Додати новий feedback
app.post("/api/feedbacks", (req, res) => {
  try {
    const { name, descr, rating } = req.body;
    
    if (!name || !descr || !rating) {
      return res.status(400).json({ error: "Відсутні обов'язкові поля" });
    }
    
    const newFeedback = {
      id: feedbacks.length + 1,
      name,
      descr,
      rating: parseInt(rating) || 0,
      createdAt: new Date().toISOString()
    };
    
    feedbacks.push(newFeedback);
    res.status(201).json(newFeedback);
  } catch (error) {
    res.status(500).json({ error: "Помилка запиту", message: error.message });
  }
});

// Експортуємо app для Vercel serverless
export default app;

// Запуск сервера тільки для локальної розробки
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

