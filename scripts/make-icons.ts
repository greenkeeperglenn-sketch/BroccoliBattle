/**
 * Rasterises the Broccoli Battle app icon SVG into the PNG sizes the PWA
 * manifest needs. Run once with `pnpm icons`; outputs are committed.
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

function broccoliSvg(opts: { padding: number; bg: string }): string {
  const { padding, bg } = opts;
  // The character is drawn in a 512-unit box, inset by `padding`.
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${bg === "none" ? 0 : 110}" fill="${bg === "none" ? "transparent" : bg}"/>
  <g transform="translate(${padding} ${padding}) scale(${(512 - padding * 2) / 512})">
    <!-- stalk -->
    <path d="M216 330 L206 452 Q256 476 306 452 L296 330 Z" fill="#b7dd8f" stroke="#2b2117" stroke-width="18" stroke-linejoin="round"/>
    <!-- floret cluster -->
    <g fill="#2f9e44" stroke="#2b2117" stroke-width="18" stroke-linejoin="round">
      <circle cx="152" cy="196" r="82"/>
      <circle cx="256" cy="132" r="96"/>
      <circle cx="360" cy="196" r="82"/>
      <circle cx="196" cy="272" r="76"/>
      <circle cx="316" cy="272" r="76"/>
      <circle cx="256" cy="228" r="88" stroke="none"/>
    </g>
    <!-- floret texture -->
    <g fill="#57b866">
      <circle cx="152" cy="172" r="22"/>
      <circle cx="244" cy="112" r="24"/>
      <circle cx="332" cy="150" r="20"/>
      <circle cx="368" cy="216" r="18"/>
      <circle cx="180" cy="244" r="16"/>
    </g>
    <!-- face -->
    <g>
      <circle cx="216" cy="252" r="26" fill="#fff" stroke="#2b2117" stroke-width="12"/>
      <circle cx="308" cy="252" r="26" fill="#fff" stroke="#2b2117" stroke-width="12"/>
      <circle cx="222" cy="258" r="10" fill="#2b2117"/>
      <circle cx="302" cy="258" r="10" fill="#2b2117"/>
      <path d="M226 312 Q262 344 298 312" fill="none" stroke="#2b2117" stroke-width="16" stroke-linecap="round"/>
      <!-- determined eyebrows -->
      <path d="M186 216 L242 230" stroke="#2b2117" stroke-width="16" stroke-linecap="round"/>
      <path d="M338 216 L282 230" stroke="#2b2117" stroke-width="16" stroke-linecap="round"/>
    </g>
  </g>
</svg>`;
}

async function main() {
  const out = path.resolve(process.cwd(), "public/icons");
  mkdirSync(out, { recursive: true });

  const standard = Buffer.from(broccoliSvg({ padding: 40, bg: "#ffc93c" }));
  const maskable = Buffer.from(broccoliSvg({ padding: 90, bg: "#ffc93c" }));

  await sharp(standard).resize(512, 512).png().toFile(path.join(out, "icon-512.png"));
  await sharp(standard).resize(192, 192).png().toFile(path.join(out, "icon-192.png"));
  await sharp(standard).resize(180, 180).png().toFile(path.join(out, "apple-touch-icon.png"));
  await sharp(maskable).resize(512, 512).png().toFile(path.join(out, "maskable-512.png"));
  console.log("✅ Icons written to public/icons");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
