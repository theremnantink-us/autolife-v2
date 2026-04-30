# Промпты для перегенерации фото

**Целевой формат:** WebP, аспект 16:10, 1280×800 (или 1920×1200).
**Папка для готовых файлов:** `.worktrees/redesign-v2/site/public/IMG/`
**Имя файла менять нельзя** — сайт ссылается на эти точные имена.
**Без людей** — только машины, инструменты, поверхности. Максимум — рука в перчатке.

---

## Общий стилевой суффикс (добавлять к каждому промпту через запятую)

> _photorealistic professional automotive studio photograph, dark high-end detailing studio environment, cinematic dramatic side lighting, deep blacks, polished chrome reflections, colour palette: graphite #1a1d22, chrome #b6bbc0, hot accent #f5f7fa, shallow depth of field, sharp focus on subject, soft cooler shadows, magazine-grade composition, **no people, no faces, no bodies, no portraits — gloved hands only when strictly required**, no text, no watermarks, no logos visible, aspect ratio 16:10, 4K detail, sharp specular highlights._

---

## Мойка (6 фото)

### 1. `CarWash.webp` — Мойка кузова
> Black luxury sedan covered in thick white foam from a high-pressure pre-wash, foam cascading down polished paintwork onto the floor, foam lance suspended in frame, side view, hot rim lighting from the right, empty detailing bay.

### 2. `CarWash_complex.webp` — Комплексная мойка
> Polished black sedan after a complex wash, microfiber drying towels neatly stacked on a workbench beside a coiled vacuum hose, doors open showing pristine interior, organized detailing bay scene.

### 3. `Кварцевое_покрытие.webp` — Кварцевое гидрофобное покрытие
> Gloved hand in black nitrile applying quartz hydrophobic coating with a microfiber applicator pad onto a black hood, fresh water beading on the freshly coated section, mirror-like reflective surface, only the gloved hand and applicator are visible.

### 4. `Консервация_двигателя.webp` — Мойка двигателя с консервацией
> Open engine bay of a German luxury car immediately after detailing, glossy plastics, perfectly clean intake covers, dielectric protective spray bottle resting on the strut tower, soft top-down studio light.

### 5. `NANO.webp` — NANO Комплекс
> High-end coupe completely covered in thick white snow foam during a three-stage pre-wash, alkali-free soft pillows of foam clinging to paint and PPF film, soft halo lighting, no figures.

### 6. `Detailing.webp` — Детейлинг мойка
> Flagship coupe parked in a brightly lit detailing bay mid-process, polishing pads and microfibers stacked neatly on a stainless workbench, polishing tools laid out in clean rows, no people in frame.

---

## Детейлинг (6 фото)

### 7. `Полировка_кузова.webp` — Полировка кузова
> Dual-action rotary polisher resting against a black fender mid-correction, orange foam pad pressed to paintwork, freshly polished mirror reflection forming, no person in shot — only the tool and the surface.

### 8. `Восстановление_хромированных_элементов.webp` — Восстановление хрома
> Gloved hand polishing chrome trim around a luxury car grille with a soft applicator, before-after contrast across the trim, deep mirror chrome shine, only the gloved hand visible.

### 9. `Leather.webp` — Химчистка кожаных сидений
> Close-up of premium black perforated leather seat being treated, soft horsehair detailing brush and conditioner bottle resting on the bolster, gentle foam visible on stitched panel, deep saturation, restored grain texture, no figures.

### 10. `khimchistka.webp` — Химчистка салона
> Steam extraction wand laid on an alcantara dashboard mid-process, micro-droplets of steam in the air, carpet stain removal pad on a clean floor mat in the foreground, dramatic side light, no people.

### 11. `Полировка_фар.webp` — Полировка фар
> Professional studio shot of a yellowed Xenon headlight restored back to crystal clarity, halo light effect, polishing compound and pad sitting beside the headlight, before-after split feel, no figures.

### 12. `Антидождь.webp` — Антидождь на стёкла
> Hydrophobic rain repellent on a freshly treated windshield, water beading into perfect droplets, urban night reflections in the glass, application bottle and microfiber pad on the cowl, no people.

---

## Шиномонтаж (6 фото)

### 13. `Шиномонтаж.webp` — Шиномонтаж
> Low-profile tire being mounted onto a forged alloy wheel by an automated tire-changer machine, head clamped on the rim, machine in clear focus, no operator in frame.

### 14. `Балансировка.webp` — Балансировка колёс
> Modern wheel balancing machine with a forged alloy + tire spinning on the spindle, calibration display lit in the background, balance weights laid on the steel workbench in the foreground, no people.

### 15. `Ремонт_бокового_пореза.webp` — Ремонт бокового пореза
> Tight close-up: gloved hands applying vulcanizing compound to a tubeless tire sidewall cut, technical shot of the patch and tools only, no faces or bodies visible.

### 16. `Замена_покрышек.webp` — Замена покрышек
> Two neat stacks of tires (summer + winter) chalk-labelled with the customer name, a single tire leaning against an idle wheel-change machine, organized warehouse aisle, no people.

### 17. `Хранение_шин.webp` — Хранение шин
> Climate-controlled tire storage warehouse, neatly racked sets of tires per customer with shelf labels, cool blue overhead lighting, deep aisle perspective, completely empty of people.

### 18. `Шлифовка_бортов_диска.webp` — Шлифовка бортов диска
> Industrial CNC lathe restoring the edge of an alloy wheel, fine metal shavings curling away, mirror finish forming on the lip, precision tooling visible, machine-only shot, no operator.

---

## Промо (2 фото)

### 19. `khimchistka_promo.webp` — Промо: Химчистка салона
> Hero shot of a fully detailed luxury sedan interior — perfectly cleaned alcantara headliner, immaculate leather seats, polished dashboard, doors open, magazine-quality composition, deep contrast, no people.

### 20. `Mercedes_promo.webp` — Промо: Керамическое покрытие
> Black AMG-style coupe under controlled studio lights with deep mirror finish from a freshly applied ceramic coating, water beading on the hood, hero three-quarter composition, empty studio.

---

## Робот-мойка — 4 режима (новая категория услуг)

Эти 4 фото идут в карточках услуг (см. `data/services.ts` категория `robot-wash`). Аспект 16:9 / 16:10. Нумерация продолжает основную.

> **Важно для всех 4:** установка _touchless_ — никаких щёток, ни вращающихся, ни мягких. Только верхняя напорная штанга на потолочных рельсах. Пена везде **розовая**.

### 21. `robot-express.webp` — Экспресс (5 мин / 600 ₽)
> Automated touchless tunnel car wash during the shampoo phase: black sedan covered in soft pink foam from an overhead high-pressure boom lance moving along ceiling rails, conveyor floor with guide rails, cool blue LED indicator strip on the wall, fully automated touchless system — absolutely no rotating brushes anywhere in frame, dark industrial bay, no people.

### 22. `robot-standart.webp` — Стандарт (8 мин / 800 ₽)
> Automated touchless car wash mid-cycle: pink foam clinging to a black sedan being rinsed by an overhead high-pressure boom on ceiling rails, mild air-knife dryer arch visible at the exit, warm-white LED panels along the tunnel, conveyor floor, no rotating brushes anywhere in frame, fully automated, no people.

### 23. `robot-optimal.webp` — Оптимальная (10 мин / 1 000 ₽)
> Automated touchless car wash during the wax and osmosis phase: overhead high-pressure boom dispensing liquid wax onto a sedan still glistening with pink foam residue, deionised-water rinse pipes visible above, blue and amber LED accents on bay walls, no rotating brushes anywhere, premium-grade touchless equipment, no people.

### 24. `robot-premium.webp` — Премиум (13 мин / 1 300 ₽)
> Premium automated touchless car wash bay: vivid hot-pink foam lava cascading over a black sedan from an overhead high-pressure boom on ceiling rails, underbody high-pressure underwash visible through floor grates, dual air-knife dryer arches behind the car, dramatic studio lighting, no rotating brushes anywhere, futuristic industrial scene, no people.

---

## Робот-мойка — заглушки галереи (3, опционально)

### 25. `placeholder-robot-1.webp`
> Automated touchless car wash bay with an overhead high-pressure boom lance on ceiling rails spraying pink foam over a black sedan, side view, dramatic backlit foam spray, blue LED accents, fully automated — no rotating brushes anywhere, no operators.

### 26. `placeholder-robot-2.webp`
> Industrial blow dryer at the exit of an automated wash tunnel finishing a luxury car, water rivulets being pushed off polished paint by air jets, no streaks, fully automated bay, no people.

### 27. `placeholder-robot-3.webp`
> Final quality inspection station with overhead inspection lights illuminating a freshly washed black sedan, microfiber cloth and inspection flashlight resting on a workbench in the foreground, dark studio environment, no figures.

---

## Подсказки

- **FLUX (fal.ai / Replicate)** — топ-1 для photorealistic + dark studio. Если выходят люди, добавь negative prompt: `people, person, human, face, hands without gloves, body, portrait, mannequin`.
- **Ideogram 3.0 turbo** — лучше всех держит «никаких людей в кадре» если это явно прописано в основном промпте (не negative).
- **Recraft v3 photo-realistic** — даёт самый предсказуемый dark studio look, легко управляется.
- **Аспект 16:10** не везде есть — ставь 16:9 и обрезай сверху/снизу.
- Для Полировки/Хрома/Кожи где сцена содержит руку в перчатке — пиши явно `single gloved hand only, no other body parts`.
