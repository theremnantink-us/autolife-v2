/**
 * Promotions / Акции.
 *
 * Currently only featured detailing offers — seasonal "Подготовка к зиме/лету"
 * cards were removed by request. Photos for these are slated for Nano Banana
 * regeneration in the dark/chrome studio style.
 */

export interface Promotion {
  id: string;
  title: string;
  description: string;
  badge: string;          // ribbon / category tag
  highlight?: boolean;    // chrome-ring featured treatment
  image: string;
  alt: string;
  cta: string;
  bookService: string;    // value to push into booking-form prefill
  bookPrice: number;
  // Optional small footnote line (e.g. promo terms)
  note?: string;
}

export const promotions: Promotion[] = [
  {
    id: 'interior-cleaning-feature',
    title: 'Химчистка салона',
    description: 'Глубокая очистка всех поверхностей кузова и салона. Удаление запахов, обработка кожи кондиционером.',
    badge: 'Популярное',
    highlight: true,
    image: '/IMG/interior-cleaning-promo.webp',
    alt: 'Химчистка салона',
    cta: 'Записаться онлайн',
    bookService: 'Химчистка салона',
    bookPrice: 18000,
    note: 'от 18 000 ₽',
  },
  {
    id: 'ceramic-feature',
    title: 'Керамическое покрытие',
    description: 'Долговечная керамическая защита лакокрасочного покрытия. Глубина цвета и сильный гидрофоб на месяцы вперёд.',
    badge: 'Хит детейлинга',
    highlight: true,
    image: '/IMG/ceramic-promo.webp',
    alt: 'Керамическое покрытие',
    cta: 'Записаться онлайн',
    bookService: 'Керамическое покрытие',
    bookPrice: 30000,
    note: 'от 30 000 ₽',
  },
];
