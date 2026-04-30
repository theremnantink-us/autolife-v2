/**
 * Gallery items — verbatim from public_html/index.php (#gallery section).
 * Keep order, captions, categories, and tall/regular size flags exactly.
 */

export type GalleryCategory = 'washing' | 'detailing' | 'tires';

export interface GalleryItem {
  src: string;
  alt: string;
  title: string;
  caption: string;
  category: GalleryCategory;
  tall?: boolean;
  placeholder?: boolean;   // marks items waiting on real photos
}

export const galleryFilters = [
  { id: 'all',       label: 'Все работы' },
  { id: 'washing',   label: 'Мойка' },
  { id: 'detailing', label: 'Детейлинг' },
  { id: 'tires',     label: 'Шиномонтаж' },
] as const;

export const galleryItems: GalleryItem[] = [
  { src: '/IMG/Mercedes.webp', alt: 'Мойка премиум-класса', title: 'Мойка премиум-класса', caption: 'Mercedes-Benz GT',     category: 'washing',   tall: true  },
  { src: '/IMG/3.webp',        alt: 'Полировка кузова',     title: 'Полировка кузова',     caption: 'Audi Q8',              category: 'detailing'              },
  { src: '/IMG/13.webp',       alt: 'Химчистка салона',     title: 'Химчистка салона',     caption: 'BMW X5',               category: 'detailing'              },
  { src: '/IMG/12.webp',       alt: 'Мойка мотоцикла',      title: 'Мойка мотоцикла',      caption: 'Yamaha',               category: 'washing'                },
  { src: '/IMG/Галш7.webp',    alt: 'Шиномонтаж',           title: 'Шиномонтаж',           caption: 'Комплексное обслуживание', category: 'tires', tall: true  },
  { src: '/IMG/Галш1.webp',    alt: 'Шиномонтаж',           title: 'Шиномонтаж',           caption: 'Замена покрышек',      category: 'tires',     tall: true  },
];
