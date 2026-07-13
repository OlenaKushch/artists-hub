import SPRITE_RAW from "../../img/sprite.svg?raw";

export const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">
      <rect width="100%" height="100%" fill="#0b0b0b"/>
      <text x="50%" y="50%" fill="#888" font-family="IBM Plex Sans,Arial,sans-serif"
            font-size="28" text-anchor="middle" dominant-baseline="middle">No image</text>
    </svg>`
  );

const SPRITE_CONTAINER_ID = "GLOBAL_SVG_SPRITE";

export function ensureSpriteMounted(doc = document) {
  if (doc.getElementById(SPRITE_CONTAINER_ID)) return;
  const wrap = doc.createElement("div");
  wrap.id = SPRITE_CONTAINER_ID;
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.position = "absolute";
  wrap.style.width = "0";
  wrap.style.height = "0";
  wrap.style.overflow = "hidden";
  wrap.innerHTML = SPRITE_RAW;
  doc.body.prepend(wrap);
}

export const icon = (id, cls = "ico") =>
  `<svg class="${cls}" aria-hidden="true"><use href="#${id}" xlink:href="#${id}"></use></svg>`;
