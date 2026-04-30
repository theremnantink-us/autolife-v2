#!/usr/bin/env node
/**
 * regen-photos.mjs — batch-regenerate site imagery via Gemini 2.5 Flash Image
 *                    (the model behind «Nano Banana»).
 *
 * Reads a manifest of {path, subject, …} entries, calls Gemini per item with
 * a shared brand-style template, and writes the returned image as a PNG into
 * /public/IMG/. PNGs can later be converted to WebP via:
 *
 *   for f in public/IMG/*.gen.png; do
 *     cwebp -q 82 "$f" -o "${f%.gen.png}.webp"
 *   done
 *
 * USAGE
 *   GEMINI_API_KEY=… node scripts/regen-photos.mjs            # all
 *   GEMINI_API_KEY=… node scripts/regen-photos.mjs polishing  # single slug
 *   GEMINI_API_KEY=… node scripts/regen-photos.mjs --dry      # show prompts only
 *
 * ENV
 *   GEMINI_API_KEY  required (https://aistudio.google.com/apikey)
 *   GEMINI_MODEL    optional, defaults to "gemini-2.5-flash-image"
 *   ASPECT          optional, defaults to "16:10" (matches service-card aspect)
 *
 * Output filenames are suffixed with `.gen.png` so they don't clobber the
 * existing assets until you've reviewed them and renamed.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename, extname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT_DIR = resolve(ROOT, 'public/IMG');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL   = process.env.GEMINI_MODEL || 'gemini-2.5-flash-image';
const ASPECT  = process.env.ASPECT || '16:10';
const DRY     = process.argv.includes('--dry');
const ONLY    = process.argv.find(a => !a.startsWith('--') && a !== process.argv[1] && a !== process.argv[0]);

/* ───────────────────── Brand style ─────────────────────
   Suffix appended to every per-image prompt so the whole set lands in the
   same visual world: dark professional automotive photography, chrome +
   graphite palette, cinematic studio lighting, NO people on screen
   (gloved hands at most). Tweak once → whole set stays consistent. */
const STYLE = [
  'photorealistic professional automotive studio photograph',
  'dark high-end detailing studio environment',
  'cinematic dramatic side lighting, deep blacks, polished chrome reflections',
  'colour palette: graphite #1a1d22, chrome #b6bbc0, hot accent #f5f7fa',
  'shallow depth of field, sharp focus on subject, soft cooler shadows',
  'magazine-grade composition',
  'no people, no faces, no bodies, no portraits — gloved hands only when strictly required',
  'no text, no watermarks, no logos visible',
  `aspect ratio ${ASPECT}, 4K detail, sharp specular highlights`,
].join(', ');

/* ───────────────────── Manifest ─────────────────────
   `slug` matches data/services.ts where applicable so single-item regen
   from CLI is easy. `out` is the output filename (under public/IMG/). */
const MANIFEST = [
  // ── Мойка ─────────────────────────────────────────
  { slug: 'washing-body',       out: 'CarWash.gen.png',                       subject: 'Black luxury sedan covered in thick white foam from a high-pressure pre-wash, foam cascading down polished paintwork onto the floor, foam lance suspended in frame, side view, hot rim lighting from the right, empty detailing bay' },
  { slug: 'washing-complex',    out: 'CarWash_complex.gen.png',               subject: 'Polished black sedan after a complex wash, microfiber drying towels neatly stacked on a workbench beside a coiled vacuum hose, doors open showing pristine interior, organized detailing bay scene' },
  { slug: 'quartz-coating',     out: 'Кварцевое_покрытие.gen.png',             subject: 'Gloved hand in black nitrile applying quartz hydrophobic coating with a microfiber applicator pad onto a black hood, fresh water beading on the freshly coated section, mirror-like reflective surface, only the gloved hand and applicator are visible' },
  { slug: 'engine-wash',        out: 'Консервация_двигателя.gen.png',          subject: 'Open engine bay of a German luxury car immediately after detailing, glossy plastics, perfectly clean intake covers, dielectric protective spray bottle resting on the strut tower, soft top-down studio light' },
  { slug: 'nano-complex',       out: 'NANO.gen.png',                          subject: 'High-end coupe completely covered in thick white snow foam during a three-stage pre-wash, alkali-free soft pillows of foam clinging to paint and PPF film, soft halo lighting, no figures' },
  { slug: 'detail-wash',        out: 'Detailing.gen.png',                     subject: 'Flagship coupe parked in a brightly lit detailing bay mid-process, polishing pads and microfibers stacked neatly on a stainless workbench, polishing tools laid out in clean rows, no people in frame' },

  // ── Детейлинг ─────────────────────────────────────
  { slug: 'polishing',          out: 'Полировка_кузова.gen.png',               subject: 'Dual-action rotary polisher resting against a black fender mid-correction, orange foam pad pressed to paintwork, freshly polished mirror reflection forming, no person in shot — only the tool and the surface' },
  { slug: 'chrome-restoration', out: 'Восстановление_хромированных_элементов.gen.png', subject: 'Gloved hand polishing chrome trim around a luxury car grille with a soft applicator, before-after contrast across the trim, deep mirror chrome shine, only the gloved hand visible' },
  { slug: 'leather-cleaning',   out: 'Leather.gen.png',                       subject: 'Close-up of premium black perforated leather seat being treated, soft horsehair detailing brush and conditioner bottle resting on the bolster, gentle foam visible on stitched panel, deep saturation, restored grain texture, no figures' },
  { slug: 'interior-cleaning',  out: 'khimchistka.gen.png',                   subject: 'Steam extraction wand laid on an alcantara dashboard mid-process, micro-droplets of steam in the air, carpet stain removal pad on a clean floor mat in the foreground, dramatic side light, no people' },
  { slug: 'headlight-polishing',out: 'Полировка_фар.gen.png',                  subject: 'Professional studio shot of a yellowed Xenon headlight restored back to crystal clarity, halo light effect, polishing compound and pad sitting beside the headlight, before-after split feel, no figures' },
  { slug: 'rain-repellent',     out: 'Антидождь.gen.png',                     subject: 'Hydrophobic rain repellent on a freshly treated windshield, water beading into perfect droplets, urban night reflections in the glass, application bottle and microfiber pad on the cowl, no people' },

  // ── Шиномонтаж ────────────────────────────────────
  { slug: 'tire-service',       out: 'Шиномонтаж.gen.png',                    subject: 'Low-profile tire being mounted onto a forged alloy wheel by an automated tire-changer machine, head clamped on the rim, machine in clear focus, no operator in frame' },
  { slug: 'wheel-balancing',    out: 'Балансировка.gen.png',                  subject: 'Modern wheel balancing machine with a forged alloy + tire spinning on the spindle, calibration display lit in the background, balance weights laid on the steel workbench in the foreground, no people' },
  { slug: 'side-cut-repair',    out: 'Ремонт_бокового_пореза.gen.png',         subject: 'Tight close-up: gloved hands applying vulcanizing compound to a tubeless tire sidewall cut, technical shot of the patch and tools only, no faces or bodies visible' },
  { slug: 'tire-change',        out: 'Замена_покрышек.gen.png',               subject: 'Two neat stacks of tires (summer + winter) chalk-labelled with the customer name, a single tire leaning against an idle wheel-change machine, organized warehouse aisle, no people' },
  { slug: 'tire-storage',       out: 'Хранение_шин.gen.png',                  subject: 'Climate-controlled tire storage warehouse, neatly racked sets of tires per customer with shelf labels, cool blue overhead lighting, deep aisle perspective, completely empty of people' },
  { slug: 'disc-edge-grinding', out: 'Шлифовка_бортов_диска.gen.png',          subject: 'Industrial CNC lathe restoring the edge of an alloy wheel, fine metal shavings curling away, mirror finish forming on the lip, precision tooling visible, machine-only shot, no operator' },

  // ── Промо (оставшиеся после удаления зимы/лета) ────
  { slug: 'promo-interior',     out: 'khimchistka_promo.gen.png',             subject: 'Hero shot of a fully detailed luxury sedan interior — perfectly cleaned alcantara headliner, immaculate leather seats, polished dashboard, doors open, magazine-quality composition, deep contrast, no people' },
  { slug: 'promo-ceramic',      out: 'Mercedes_promo.gen.png',                subject: 'Black AMG-style coupe under controlled studio lights with deep mirror finish from a freshly applied ceramic coating, water beading on the hood, hero three-quarter composition, empty studio' },

  // ── Робот-мойка (4 режима — Express → Premium, touchless, no brushes) ─
  { slug: 'robot-express',      out: 'robot-express.gen.png',                 subject: 'Automated touchless tunnel car wash during the shampoo phase: black sedan covered in soft pink foam from an overhead high-pressure boom lance moving along ceiling rails, conveyor floor with guide rails, cool blue LED indicator strip on the wall, fully automated touchless system — absolutely no rotating brushes anywhere in frame, dark industrial bay, no people' },
  { slug: 'robot-standart',     out: 'robot-standart.gen.png',                subject: 'Automated touchless car wash mid-cycle: pink foam clinging to a black sedan being rinsed by an overhead high-pressure boom on ceiling rails, mild air-knife dryer arch visible at the exit, warm-white LED panels along the tunnel, conveyor floor, no rotating brushes anywhere in frame, fully automated, no people' },
  { slug: 'robot-optimal',      out: 'robot-optimal.gen.png',                 subject: 'Automated touchless car wash during the wax and osmosis phase: overhead high-pressure boom dispensing liquid wax onto a sedan still glistening with pink foam residue, deionised-water rinse pipes visible above, blue and amber LED accents on bay walls, no rotating brushes anywhere, premium-grade touchless equipment, no people' },
  { slug: 'robot-premium',      out: 'robot-premium.gen.png',                 subject: 'Premium automated touchless car wash bay: vivid hot-pink foam lava cascading over a black sedan from an overhead high-pressure boom on ceiling rails, underbody high-pressure underwash visible through floor grates, dual air-knife dryer arches behind the car, dramatic studio lighting, no rotating brushes anywhere, futuristic industrial scene, no people' },
];

/* ────────────────────── runtime ────────────────────── */

function fail(msg) { console.error('✖', msg); process.exit(1); }

if (!API_KEY && !DRY) fail('GEMINI_API_KEY is not set. Get one at https://aistudio.google.com/apikey');

let queue = MANIFEST;
if (ONLY) {
  queue = MANIFEST.filter(m => m.slug === ONLY || m.out.startsWith(ONLY));
  if (!queue.length) fail(`No manifest entry matches "${ONLY}"`);
}

console.log(`▸ Model: ${MODEL}`);
console.log(`▸ Aspect: ${ASPECT}`);
console.log(`▸ Output: ${OUT_DIR}`);
console.log(`▸ ${DRY ? 'DRY RUN — no API calls' : 'Generating'} ${queue.length} image(s)\n`);

await mkdir(OUT_DIR, { recursive: true });

const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

let ok = 0, ng = 0;
for (const item of queue) {
  const prompt = `${item.subject}. ${STYLE}.`;

  if (DRY) {
    console.log(`— ${item.out}`);
    console.log(`  ${prompt}\n`);
    continue;
  }

  process.stdout.write(`→ ${item.out.padEnd(48)} `);
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
    if (!part) throw new Error('no inline image in response');

    const buf = Buffer.from(part.inlineData.data, 'base64');
    const outPath = resolve(OUT_DIR, item.out);
    await writeFile(outPath, buf);
    console.log(`OK  (${(buf.length / 1024).toFixed(0)} KB)`);
    ok++;
  } catch (err) {
    console.log(`FAIL  ${err.message}`);
    ng++;
  }
}

console.log(`\n▸ Done — ${ok} OK, ${ng} failed`);
console.log(`  Files saved with .gen.png suffix to avoid overwriting originals.`);
console.log(`  Review them, then rename:`);
console.log(`    cd public/IMG && for f in *.gen.png; do mv "$f" "\${f%.gen.png}.webp"; done`);
console.log(`  (or run cwebp/sharp to encode to WebP first).`);
