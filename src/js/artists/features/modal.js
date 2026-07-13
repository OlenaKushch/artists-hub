// src/js/artists/features/modal.js
import { lockScroll, unlockScroll } from "../lib/scroll-lock.js";
import { fetchArtist, fetchArtistAlbums } from "./api.js";
import { createMiniPlayer } from "./player.js";
import { openZoom } from "./zoom.js";
import { getPrefetched } from "./prefetch.js";
import { escapeHtml } from "../../shared/html.js";
import { FALLBACK_IMG, ensureSpriteMounted, icon } from "../../shared/media.js";

/* ---------- ensure modal shell (если partial не вставлен) ---------- */
function ensureModalShell(doc = document) {
  let modal = doc.querySelector("#artist-modal");
  if (modal) return modal;

  modal = doc.createElement("div");
  modal.id = "artist-modal";
  modal.className = "amodal";
  modal.setAttribute("hidden", "");
  modal.innerHTML = `
    <div class="amodal__backdrop"></div>
    <div class="amodal__dialog" role="dialog" aria-modal="true" aria-label="Artist details">
      <button id="am-close" class="amodal__close" type="button" aria-label="Close">×</button>
      <div id="am-body" class="amodal__body">
        <div class="amodal__loader loader"></div>
      </div>
    </div>`;
  doc.body.appendChild(modal);
  return modal;
}

/* ----------------- helpers ----------------- */
function fmtTime(msLike) {
  const ms = Number(msLike);
  if (!Number.isFinite(ms)) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}
function years(d = {}) {
  const s = d.formedYear || d.intFormedYear || d.yearStart;
  const e = d.endedYear || d.intDisbandedYear || d.intDiedYear || d.yearEnd;
  if (s && e) return `${s}–${e}`;
  if (s) return `${s}–present`;
  return "information missing";
}
function isDirectYouTubeVideo(href = "") {
  if (!href) return false;
  try {
    const u = new URL(href, location.href);
    if (/youtu\.be$/.test(u.hostname)) return !!u.pathname.slice(1);
    if (/[?&]v=/.test(u.search)) return true;
    return /\/(embed|shorts|v)\//.test(u.pathname);
  } catch {
    return false;
  }
}
function buildTrackLink(t = {}, artistName = "") {
  const direct =
    t.youtube ||
    t.youtube_url ||
    t.url ||
    t.movie ||
    t.strMusicVid ||
    "";
  if (direct) return direct;

  // Фолбек: если у трека нет прямой ссылки, формируем YouTube‑поиск
  const title = t.title || t.strTrack || t.name || "";
  const q = [artistName, title].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  if (!q) return "";
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function trackRow(t = {}, artistName = "") {
  const title = escapeHtml(t.title || t.strTrack || t.name || "—");
  const dur   = fmtTime(t.duration ?? t.intDuration ?? t.time);
  const link  = buildTrackLink(t, artistName);
  const safeLink = escapeHtml(link);
  return `
    <li class="tr">
      <span>${title}</span>
      <span>${dur}</span>
      <span>${
        link
          ? `<a class="yt" href="${safeLink}" target="_blank" rel="noopener noreferrer" aria-label="Play">
               ${icon("icon-icon_youtube_footer", "ico am-yt")}
             </a>`
          : `<span class="yt-ph"></span>`
      }</span>
    </li>`;
}
function dedupe(arr){const s=new Set(),r=[];for(const x of arr){if(x&&!s.has(x)){s.add(x);r.push(x)}}return r;}
function isMixRadioOn(){
  // индикатор MixRadio — подстрой под свой markup при желании
  return !!document.querySelector('#random-radio[aria-pressed="true"], .toolbar__mixradio.is-active, body.mixradio-on');
}

/* ----------------- main ----------------- */
export function createArtistModal(rootEl = document) {
  // смонтировать спрайт (идемпотентно)
  ensureSpriteMounted(document);

  const modal =
    (rootEl && rootEl.querySelector ? rootEl.querySelector("#artist-modal") : null) ||
    document.querySelector("#artist-modal") ||
    ensureModalShell(document);

  const modalBody  = modal.querySelector("#am-body");
  const modalClose = modal.querySelector("#am-close");
  const dialog     = modal.querySelector(".amodal__dialog");

  // единый мини-плеер для сайта
  const player = createMiniPlayer();

  // Scroll-to-top в диалоге
  let scrollTopBtn = null;
  let onDialogScroll = null;
  let onWinResize    = null;

  function placeScrollTop() {
    try {
      const pad = 24;
      const r = dialog.getBoundingClientRect();
      const right = Math.max(pad, window.innerWidth - (r.left + r.width) + pad);
      scrollTopBtn.style.right  = `${right}px`;
      scrollTopBtn.style.bottom = `58px`;
    } catch {}
  }
  function ensureScrollTop() {
    if (!scrollTopBtn) {
      scrollTopBtn = document.createElement("button");
      scrollTopBtn.type = "button";
      scrollTopBtn.className = "amodal__scrolltop";
      scrollTopBtn.setAttribute("aria-label", "Scroll to top");
      scrollTopBtn.textContent = "↑";
      dialog.appendChild(scrollTopBtn);
      scrollTopBtn.addEventListener("click", () => {
        dialog.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
    if (onDialogScroll) dialog.removeEventListener("scroll", onDialogScroll);
    if (onWinResize) {
      window.removeEventListener("resize", onWinResize);
      window.visualViewport?.removeEventListener("resize", onWinResize);
      window.removeEventListener("orientationchange", onWinResize);
    }
    onDialogScroll = () => {
      try {
        scrollTopBtn.style.display = (dialog.scrollTop || 0) > 220 ? "flex" : "none";
        placeScrollTop();
      } catch {}
    };
    dialog.addEventListener("scroll", onDialogScroll);

    onWinResize = () => { placeScrollTop(); };
    window.addEventListener("resize", onWinResize);
    window.visualViewport?.addEventListener("resize", onWinResize);
    window.addEventListener("orientationchange", onWinResize);

    placeScrollTop();
  }

  // -------- open/close --------
  const onEsc = (e) => { if (e.key === "Escape") { close(); } };

  function open() {
    modal.removeAttribute("hidden");
    lockScroll();
    ensureScrollTop();
    if (scrollTopBtn) scrollTopBtn.style.display = "none";
    modalBody.innerHTML = `<div class="amodal__loader loader"></div>`;
    document.addEventListener("keydown", onEsc);
  }

  function close() {
    modal.setAttribute("hidden", "");
    unlockScroll();
    modalBody.innerHTML = "";
    document.removeEventListener("keydown", onEsc);

    if (onDialogScroll) { dialog.removeEventListener("scroll", onDialogScroll); onDialogScroll = null; }
    if (onWinResize) {
      window.removeEventListener("resize", onWinResize);
      window.visualViewport?.removeEventListener("resize", onWinResize);
      window.removeEventListener("orientationchange", onWinResize);
      onWinResize = null;
    }
    if (scrollTopBtn) scrollTopBtn.style.display = "none";
  }

  modalClose.addEventListener("click", () => { close(); });
  modal.addEventListener("click", (e) => {
    if (e.target.classList.contains("amodal__backdrop")) {
      close();
    }
  });

  // Делегирование: YouTube (очередь) и Zoom по картинке
  modal.addEventListener("click", (e) => {
    const a = e.target.closest("a.yt");
    if (a) {
      const href = a.href || a.getAttribute("href") || "";
      // Если это не прямое YouTube‑видео (например, страница поиска) —
      // даём браузеру открыть ссылку как обычно в новой вкладке.
      if (!isDirectYouTubeVideo(href)) {
        return;
      }
      e.preventDefault();

      // собираем ВСЕ треки в модалке, делаем очередь
      const links = Array.from(modal.querySelectorAll("a.yt"));
      const hrefs = dedupe(
        links
          .map((x) => x.href)
          .filter((url) => url && isDirectYouTubeVideo(url))
      );
      let start = hrefs.indexOf(a.href);
      if (start < 0) start = 0;

      if (!hrefs.length) { player.open(a.href); return; }

      const mix = isMixRadioOn();
      player.openQueue(hrefs, { startIndex: start, shuffle: mix, loop: mix });
      return;
    }
    const zoomImg = e.target.closest(".amodal__img");
    if (zoomImg) {
      const src =
        zoomImg.currentSrc ||
        zoomImg.getAttribute("src") ||
        zoomImg.getAttribute("data-src") ||
        "";
      openZoom(src, zoomImg.getAttribute("alt") || "");
    }
  });

  // -------- render --------
  async function render(artistId) {
    // префетч-кэш (если навели курсор заранее)
    const cached = getPrefetched?.(String(artistId));

    const [artist, albums] = await Promise.all([
      cached?.artist ?? fetchArtist(artistId).catch(() => null),
      cached?.albums ?? fetchArtistAlbums(artistId).catch(() => []),
    ]);

    const d = artist || {};
    const name    = escapeHtml(d.name || d.strArtist || "Unknown artist");
    const rawImg  = d.image || d.strArtistThumb || "";
    const img     = escapeHtml(rawImg || FALLBACK_IMG);
    const country = escapeHtml(d.country || d.strCountry || "N/A");
    const members = escapeHtml(d.members || d.intMembers || "N/A");
    const sex     = escapeHtml(d.gender  || d.strGender  || "N/A");
    const bio     = escapeHtml(d.biography || d.strBiographyEN || "");
    const genres  = Array.isArray(d.genres) ? d.genres :
                    (d.genre ? [d.genre] : []);

    const albumsArr = Array.isArray(albums) ? albums : [];
    const artistNameRaw = d.name || d.strArtist || "";
    const albumsMarkup = albumsArr.map(alb => {
      const title  = escapeHtml(alb?.title || alb?.strAlbum || alb?.name || "Album");
      const tracks = Array.isArray(alb?.tracks) ? alb.tracks :
                     (Array.isArray(alb?.songs) ? alb.songs : []);
      return `
        <div class="am-album">
          <div class="am-album__title">${title}</div>
          <ul class="tbl">
            <li class="th"><span>Track</span><span>Time</span><span>Link</span></li>
            ${tracks.map(tr => trackRow(tr, artistNameRaw)).join("")}
          </ul>
        </div>`;
    }).join("");

    modalBody.innerHTML = `
      <h3 class="amodal__title">${name}</h3>

      <div class="amodal__content">
        <img class="amodal__img" src="${img}" alt="${name}" loading="lazy">
        <div class="amodal__info">
          <div class="am-meta">
            <div class="am-meta__col">
              <div class="am-meta__item"><span class="lbl">Years active</span><span class="val">${escapeHtml(years(d))}</span></div>
              <div class="am-meta__item"><span class="lbl">Sex</span><span class="val">${sex}</span></div>
            </div>
            <div class="am-meta__col">
              <div class="am-meta__item"><span class="lbl">Members</span><span class="val">${members}</span></div>
              <div class="am-meta__item"><span class="lbl">Country</span><span class="val">${country}</span></div>
            </div>
          </div>

          <div class="am-bio">
            <div class="lbl">Biography</div>
            <p>${bio || "—"}</p>
          </div>

          ${genres.length ? `<div class="am-tags">${genres.map(g => `<span class="tag">${escapeHtml(g)}</span>`).join("")}</div>` : ""}
        </div>
      </div>

      <h4 class="amodal__albums-title">Albums</h4>
      <div class="amodal__albums">
        ${albumsMarkup || "<p class='muted'>No albums found for this artist.</p>"}
      </div>`;

    const modalImg = modalBody.querySelector(".amodal__img");
    if (modalImg) {
      modalImg.onerror = () => { modalImg.onerror = null; modalImg.src = FALLBACK_IMG; };
    }
  }

  // -------- public API --------
  async function openFor(id) {
    open();
    await render(id);
  }

  return { openFor, close };
}
