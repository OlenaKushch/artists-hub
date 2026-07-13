import { initGrid } from "./grid.js";
import { createArtistModal } from "./modal.js";
import { initRouter } from "./router.js";
import { initPrefetch } from "./prefetch.js";

export function initArtists(root = document.querySelector("#artists-section")) {
  if (!root) return;

  // URL-sync first (restores state before initial load)
  initRouter();

  // Single modal instance owned here
  const modal = createArtistModal(document);

  initPrefetch(root);

  initGrid(root, { openFor: (id) => modal.openFor(id) });
}
