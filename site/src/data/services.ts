/**
 * Services — verbatim from public_html/index.php (#services section).
 * 18 cards, 3 categories. Order, names, prices, descriptions, includes
 * lists, image paths, and button modes are 1:1 with the original.
 *
 * Do not change content. Only structural fields (slug for routing) added.
 */

export type ServiceCategory = 'washing' | 'robot-wash' | 'detailing' | 'tire-service';

export interface Service {
  slug: string;
  name: string;
  price: string;          // verbatim "от … руб." string
  priceValue: number;     // numeric for analytics / pre-fill
  description: string;
  image: string;          // path under /IMG/
  alt: string;
  includes: string[];
  cta: 'queue' | 'book';  // queue = живая очередь only; book = booking form
  category: ServiceCategory;
}

export const categories = [
  { id: 'washing',      label: 'Мойка',         title: 'Мойка автомобилей' },
  { id: 'detailing',    label: 'Детейлинг',     title: 'Детейлинг услуги' },
  { id: 'tire-service', label: 'Шиномонтаж',    title: 'Шиномонтаж и обслуживание колёс' },
  { id: 'robot-wash',   label: 'Робот-мойка',   title: 'Робот-мойка — автоматические режимы' },
] as const;

export const services: Service[] = [
  // ───────── Мойка ─────────
  {
    slug: 'washing-body',
    name: 'Мойка кузова',
    price: 'от 1100 руб.',
    priceValue: 1100,
    description: 'Тщательная очистка кузова с использованием профессиональных средств',
    image: '/IMG/service-car-wash.webp',
    alt: 'Мойка кузова',
    includes: [
      'Бесконтактная мойка высокого давления',
      'Щадящие моющие средства',
      'Сушка микрофиброй',
    ],
    cta: 'queue',
    category: 'washing',
  },
  {
    slug: 'washing-complex',
    name: 'Комплексная мойка',
    price: 'от 2100 руб.',
    priceValue: 2100,
    description: 'Полный уход за автомобилем снаружи и внутри',
    image: '/IMG/service-complex-wash.webp',
    alt: 'Комплексная мойка',
    includes: [
      'Двухфазная мойка кузова',
      'Аэрочистка салона',
      'Влажная уборка',
      'Пылесос',
      'Протирка стекол',
    ],
    cta: 'queue',
    category: 'washing',
  },
  {
    slug: 'quartz-coating',
    name: 'Кварцевое гидрофобное покрытие',
    price: 'от 1500 руб.',
    priceValue: 1500,
    description: 'Ультра-гидрофобное покрытие для защиты и блеска',
    image: '/IMG/service-quartz-coating.webp',
    alt: 'Кварцевое покрытие',
    includes: [
      'Мгновенное нанесение',
      'Эффект «зеркала»',
      'Защита от грязи и реагента',
    ],
    cta: 'queue',
    category: 'washing',
  },
  {
    slug: 'engine-wash',
    name: 'Мойка двигателя с консервацией',
    price: 'от 3000 руб.',
    priceValue: 3000,
    description: 'Очистка двигателя от грязи и масляных пятен',
    image: '/IMG/service-engine-wash.webp',
    alt: 'Мойка двигателя',
    includes: [
      'Использование диэлектрического геля',
      'Двухфазная контактная мойка',
      'Консервация для сохранения чистоты',
    ],
    cta: 'queue',
    category: 'washing',
  },
  {
    slug: 'nano-complex',
    name: 'NANO Комплекс',
    price: 'от 2900 руб.',
    priceValue: 2900,
    description: 'Трёхфазная мойка с использованием щадящих средств',
    image: '/IMG/service-nano-complex.webp',
    alt: 'NANO Комплекс',
    includes: [
      'Использование бесщелочной пены',
      'Безопасно для покрытий и плёнок',
      'Покрытие воском',
    ],
    cta: 'queue',
    category: 'washing',
  },
  {
    slug: 'detail-wash',
    name: 'Детейлинг мойка',
    price: 'от 6000 руб.',
    priceValue: 6000,
    description: 'Глубокая очистка с профессиональными средствами',
    image: '/IMG/service-detailing-wash.webp',
    alt: 'Детейлинг мойка',
    includes: [
      'Двухэтапное удаление глубоких загрязнений кузова',
      'Химчистка дисков',
      'Кварцевое покрытие кузова',
      'Тщательная уборка салона и багажника',
      'Кондиционер для кожи',
    ],
    cta: 'book',
    category: 'washing',
  },

  // ───────── Робот-мойка ─────────
  // Автоматические режимы тоннельной мойки. Все доступны только в живой
  // очереди — на робот-мойку нельзя записаться, машина проезжает по
  // расписанию работы автокомплекса.
  {
    slug: 'robot-express',
    name: 'Робот-мойка · Экспресс',
    price: 'от 600 руб.',
    priceValue: 600,
    description: 'Быстрая бесконтактная мойка кузова за 5 минут — два цикла шампуня и ополаскивания.',
    image: '/IMG/robot-express.webp',
    alt: 'Робот-мойка Экспресс',
    includes: [
      '~ 5 минут',
      'Шампунь · Мойка',
      'Шампунь · Мойка',
    ],
    cta: 'queue',
    category: 'robot-wash',
  },
  {
    slug: 'robot-standart',
    name: 'Робот-мойка · Стандарт',
    price: 'от 800 руб.',
    priceValue: 800,
    description: 'Стандартный цикл с предварительной мойкой и лёгкой воздушной сушкой.',
    image: '/IMG/robot-standart.webp',
    alt: 'Робот-мойка Стандарт',
    includes: [
      '~ 8 минут',
      'Предварительная мойка',
      'Шампунь · Мойка',
      'Шампунь · Мойка',
      'Лёгкая сушка',
    ],
    cta: 'queue',
    category: 'robot-wash',
  },
  {
    slug: 'robot-optimal',
    name: 'Робот-мойка · Оптимальная',
    price: 'от 1 000 руб.',
    priceValue: 1000,
    description: 'Полный цикл с воском, осмосом и интенсивной сушкой — лучшее соотношение цена/результат.',
    image: '/IMG/robot-optimal.webp',
    alt: 'Робот-мойка Оптимальная',
    includes: [
      '~ 10 минут',
      'Шампунь · Мойка ×2',
      'Финальная мойка',
      'Воск',
      'Осмос (деминерализованная вода)',
      'Сушка ×2',
    ],
    cta: 'queue',
    category: 'robot-wash',
  },
  {
    slug: 'robot-premium',
    name: 'Робот-мойка · Премиум',
    price: 'от 1 300 руб.',
    priceValue: 1300,
    description: 'Максимальный цикл: мойка днища, пенная лава, воск, осмос и двойная сушка для зеркального финиша.',
    image: '/IMG/robot-premium.webp',
    alt: 'Робот-мойка Премиум',
    includes: [
      '~ 13 минут',
      'Мойка днища',
      'Шампунь · Мойка ×2',
      'Пенная лава (цветная пена)',
      'Финальная мойка',
      'Воск · Осмос',
      'Сушка ×2',
    ],
    cta: 'queue',
    category: 'robot-wash',
  },

  // ───────── Детейлинг ─────────
  {
    slug: 'polishing',
    name: 'Полировка кузова',
    price: 'от 25 000 руб.',
    priceValue: 25000,
    description: 'Восстановление блеска лакокрасочного покрытия',
    image: '/IMG/service-body-polishing.webp',
    alt: 'Полировка кузова',
    includes: [
      'Удаление царапин и сколов',
      'Восстановление глянца',
      'Зеркальный глянец',
    ],
    cta: 'book',
    category: 'detailing',
  },
  {
    slug: 'chrome-restoration',
    name: 'Восстановление хромированных элементов',
    price: 'от 1500 руб.',
    priceValue: 1500,
    description: 'Восстановление и полировка хромированных деталей',
    image: '/IMG/service-chrome-restoration.webp',
    alt: 'Восстановление хрома',
    includes: [
      'Обезжиривание поверхности',
      'Удаление коррозии и потускнений',
      'Восстановление блеска хрома',
      'Нанесение защитных покрытий',
    ],
    cta: 'book',
    category: 'detailing',
  },
  {
    slug: 'leather-cleaning',
    name: 'Химчистка кожаных сидений',
    price: 'от 4000 руб.',
    priceValue: 4000,
    description: 'Глубокая очистка и восстановление кожаных сидений',
    image: '/IMG/service-leather-cleaning.webp',
    alt: 'Химчистка кожаных сидений',
    includes: [
      'Глубокая очистка кожи',
      'Удаление пятен и загрязнений',
      'Восстановление цвета и текстуры',
      'Нанесение защитных составов',
    ],
    cta: 'book',
    category: 'detailing',
  },
  {
    slug: 'interior-cleaning',
    name: 'Химчистка салона',
    price: 'от 18 000 руб.',
    priceValue: 18000,
    description: 'Глубокая очистка всех поверхностей кузова и салона',
    image: '/IMG/service-interior-cleaning.webp',
    alt: 'Химчистка салона',
    includes: [
      'Глубокая очистка кузова',
      'Химчистка всех поверхностей салона',
      'Удаление запахов',
      'Обработка кожи кондиционером',
    ],
    cta: 'book',
    category: 'detailing',
  },
  {
    slug: 'headlight-polishing',
    name: 'Полировка фар',
    price: 'от 2000 руб.',
    priceValue: 2000,
    description: 'Восстановление прозрачности фар',
    image: '/IMG/service-headlight-polishing.webp',
    alt: 'Полировка фар',
    includes: [
      'Удаление помутнений',
      'Восстановление светопропускания',
      'Защитное покрытие',
    ],
    cta: 'book',
    category: 'detailing',
  },
  {
    slug: 'rain-repellent',
    name: 'Антидождь на стёкла',
    price: 'от 3500 руб.',
    priceValue: 3500,
    description: 'Нанесение гидрофобного покрытия на стёкла',
    image: '/IMG/service-rain-repellent.webp',
    alt: 'Антидождь',
    includes: [
      'Улучшенная видимость в дождь',
      'Защита от загрязнений',
      'Долговечный эффект',
    ],
    cta: 'book',
    category: 'detailing',
  },

  // ───────── Шиномонтаж ─────────
  {
    slug: 'tire-service',
    name: 'Шиномонтаж',
    price: 'от 450 руб.',
    priceValue: 450,
    description: 'Профессиональный шиномонтаж с гарантией качества',
    image: '/IMG/service-tire-fitting.webp',
    alt: 'Шиномонтаж',
    includes: [
      'Снятие/установка колёс',
      'Балансировка',
      'Ремонт проколов и порезов',
      'Медная смазка',
    ],
    cta: 'book',
    category: 'tire-service',
  },
  {
    slug: 'wheel-balancing',
    name: 'Балансировка колёс',
    price: 'от 150 руб.',
    priceValue: 150,
    description: 'Точная балансировка для комфортной езды',
    image: '/IMG/service-wheel-balancing.webp',
    alt: 'Балансировка колёс',
    includes: [
      'Компьютерная балансировка',
      'Использование качественных грузов',
      'Проверка на стенде',
    ],
    cta: 'book',
    category: 'tire-service',
  },
  {
    slug: 'side-cut-repair',
    name: 'Ремонт бокового пореза',
    price: 'от 1000 руб.',
    priceValue: 1000,
    description: 'Качественный ремонт проколов и порезов шин',
    image: '/IMG/service-sidewall-repair.webp',
    alt: 'Ремонт бокового пореза',
    includes: [
      'Ремонт бескамерных шин',
      'Вулканизация',
      'Герметизация',
    ],
    cta: 'book',
    category: 'tire-service',
  },
  {
    slug: 'tire-storage',
    name: 'Хранение шин',
    price: 'от 5500 руб./сезон',
    priceValue: 5500,
    description: 'Правильное хранение шин в межсезонье',
    image: '/IMG/service-tire-storage.webp',
    alt: 'Хранение шин',
    includes: [
      'Специальное помещение',
      'Оптимальные условия',
      'Маркировка и учёт',
    ],
    cta: 'book',
    category: 'tire-service',
  },
  {
    slug: 'disc-edge-grinding',
    name: 'Шлифовка бортов диска',
    price: 'от 300 руб.',
    priceValue: 300,
    description: 'Восстановление внешнего вида дисков',
    image: '/IMG/service-disc-grinding.webp',
    alt: 'Шлифовка бортов диска',
    includes: [
      'Устранение царапин и следов эксплуатации',
      'Зеркальный блеск',
      'Восстановление геометрии',
    ],
    cta: 'book',
    category: 'tire-service',
  },
];

export function servicesByCategory(category: ServiceCategory) {
  return services.filter(s => s.category === category);
}
