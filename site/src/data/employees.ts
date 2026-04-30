/**
 * Employees / Команда.
 *
 * Drives the public Employees section + /staff page + booking-form
 * "Записаться к мастеру" prefill. Owners (Артур, Ирина) are NOT exposed
 * here — they live in the admin panel only.
 *
 * Photos are SVG monogram placeholders for now; real shots replace them by
 * dropping <slug>.webp into /public/IMG/staff/ and bumping `photo` here.
 */

export type EmployeeRole = 'master' | 'admin-shift' | 'admin-master';

export interface EmployeeReview {
  author: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  date: string;        // ISO date — only the day matters for display
  source?: string;     // 'yandex' | 'google' | 'site' | 'instagram'
}

export interface Employee {
  id: string;          // stable kebab-case key (used as booking master id)
  slug: string;        // used in URLs / DOM ids
  name: string;        // displayed full name
  role: EmployeeRole;
  position: string;    // visible job title
  description: string; // short bio (≤ 240 chars)
  photo: string;       // path under /public
  isBookable: boolean; // false for pure admin-shift
  yearsExp?: number;   // surfaced as small chip
  /** True when the journal should show BOTH "Админ ₽" and "Мойка ₽" inputs
   *  for this employee (Иван — admin-master; Сергей — admin-shift who
   *  occasionally washes). False/omitted = single column based on role. */
  isMultiRole?: boolean;
  specialties: string[]; // 3-5 tags shown under name
  reviews: EmployeeReview[];
}

export const employees: Employee[] = [
  {
    id: 'sergey',
    slug: 'sergey',
    name: 'Сергей',
    role: 'admin-shift',
    position: 'Администратор смены',
    description:
      'Встречает клиентов, согласует объём работ и передаёт автомобиль мастеру. Координирует загрузку постов и контроль качества.',
    photo: '/IMG/staff/sergey.svg',
    isBookable: false,
    isMultiRole: true,
    yearsExp: 5,
    specialties: ['Приёмка', 'Контроль качества', 'Координация'],
    reviews: [
      {
        author: 'Алексей',
        rating: 5,
        text: 'Чётко всё объяснил, согласовал смету заранее. Никаких сюрпризов в счёте.',
        date: '2025-09-12',
        source: 'yandex',
      },
      {
        author: 'Марина',
        rating: 5,
        text: 'Отвечает на звонки моментально, перенесла запись без проблем.',
        date: '2025-10-03',
        source: 'site',
      },
    ],
  },
  {
    id: 'ivan',
    slug: 'ivan',
    name: 'Иван',
    role: 'admin-master',
    position: 'Мастер · администратор',
    description:
      'Совмещает роль мастера по уходу и администратора смены. Отвечает за сложные кейсы детейлинга и обучение младших мастеров.',
    photo: '/IMG/staff/ivan.svg',
    isBookable: true,
    isMultiRole: true,
    yearsExp: 8,
    specialties: ['Полировка', 'Керамика', 'Химчистка', 'Приёмка'],
    reviews: [
      {
        author: 'Денис',
        rating: 5,
        text: 'Делал керамику на M5 — результат держится больше года. Видно, что человек в теме.',
        date: '2025-08-21',
        source: 'yandex',
      },
      {
        author: 'Ольга',
        rating: 5,
        text: 'Полировка у Ивана — отдельный жанр. Машина выглядит лучше, чем в салоне.',
        date: '2025-09-30',
        source: 'google',
      },
      {
        author: 'Артём',
        rating: 4,
        text: 'Качество отличное, иногда занят и приходится ждать запись пару дней.',
        date: '2025-10-15',
        source: 'site',
      },
    ],
  },
  {
    id: 'bill',
    slug: 'bill',
    name: 'Билл',
    role: 'master',
    position: 'Мастер по уходу',
    description:
      'Отвечает за сайт, маркетинг и онлайн-запись. На постах — мастер по уходу за кузовом и салоном. Любит сложные пятна и старую кожу.',
    photo: '/IMG/staff/bill.svg',
    isBookable: true,
    yearsExp: 4,
    specialties: ['Химчистка кожи', 'Удаление пятен', 'Антидождь'],
    reviews: [
      {
        author: 'Игорь',
        rating: 5,
        text: 'Кожа в моём 7-серии выглядела как новая — даже швы оживил.',
        date: '2025-07-04',
        source: 'yandex',
      },
      {
        author: 'Светлана',
        rating: 5,
        text: 'Антидождь нанёс — стекло сухое в любой ливень. Реальный буст видимости.',
        date: '2025-09-18',
        source: 'site',
      },
    ],
  },
  {
    id: 'alexander',
    slug: 'alexander',
    name: 'Александр',
    role: 'master',
    position: 'Мастер по уходу',
    description:
      'Специализируется на детейлинг-мойке премиум-класса и предпродажной подготовке. Аккуратный с любым кузовом и оптикой.',
    photo: '/IMG/staff/alexander.svg',
    isBookable: true,
    yearsExp: 6,
    specialties: ['Детейлинг-мойка', 'Полировка фар', 'Предпродажная'],
    reviews: [
      {
        author: 'Никита',
        rating: 5,
        text: 'После мойки у Александра соседи спрашивали, новая ли машина.',
        date: '2025-08-09',
        source: 'yandex',
      },
      {
        author: 'Юлия',
        rating: 5,
        text: 'Фары полировал — ночью снова видно дорогу. Спасибо!',
        date: '2025-10-22',
        source: 'google',
      },
    ],
  },
  {
    id: 'vladimir',
    slug: 'vladimir',
    name: 'Владимир',
    role: 'master',
    position: 'Мастер по уходу',
    description:
      'Профильный по шиномонтажу и хранению шин. Знает геометрию дисков и не дерёт борта на низкопрофильной резине.',
    photo: '/IMG/staff/vladimir.svg',
    isBookable: true,
    yearsExp: 9,
    specialties: ['Шиномонтаж', 'Балансировка', 'Хранение шин'],
    reviews: [
      {
        author: 'Павел',
        rating: 5,
        text: 'R20 на кованых дисках — ни одной царапины. Аккуратно делает.',
        date: '2025-04-11',
        source: 'yandex',
      },
      {
        author: 'Михаил',
        rating: 5,
        text: 'Сезонная переобувка за час, балансировка — руль идеально стоит.',
        date: '2025-10-29',
        source: 'site',
      },
    ],
  },
  {
    id: 'roman',
    slug: 'roman',
    name: 'Роман',
    role: 'master',
    position: 'Мастер по уходу',
    description:
      'Сильная сторона — химчистка салона и удаление запахов. Работает с тканевой обивкой и потолком без разводов.',
    photo: '/IMG/staff/roman.svg',
    isBookable: true,
    yearsExp: 5,
    specialties: ['Химчистка салона', 'Удаление запахов', 'Озонация'],
    reviews: [
      {
        author: 'Екатерина',
        rating: 5,
        text: 'Покупала машину после курильщика — Роман убрал запах за один заход.',
        date: '2025-08-30',
        source: 'yandex',
      },
      {
        author: 'Дмитрий',
        rating: 5,
        text: 'Тканевый потолок не пострадал, разводов нет, цвет ровный.',
        date: '2025-10-08',
        source: 'site',
      },
    ],
  },
];

export const bookableEmployees = employees.filter(e => e.isBookable);

export function findEmployee(id: string): Employee | undefined {
  return employees.find(e => e.id === id);
}
