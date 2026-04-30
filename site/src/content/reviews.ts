// site/src/content/reviews.ts
export interface Review {
  author: string;          // "Алексей М."
  car: string;             // "Mercedes-Maybach S680"
  location: string;        // "Рублёвка"
  rating: number;          // 1-5
  text: string;
  date: string;            // ISO
}

export const fallbackReviews: Review[] = [
  {
    author: 'Алексей М.',
    car: 'Mercedes-Maybach S680',
    location: 'Рублёвка',
    rating: 5,
    text: 'Двухэтапная полировка + керамика. Работа заняла 16 часов, материалы Koch Chemie. Результат держится больше года.',
    date: '2025-11-12',
  },
  {
    author: 'Дмитрий К.',
    car: 'Porsche 911 Turbo S',
    location: 'Новорижское',
    rating: 5,
    text: 'Химчистка кожаного салона после восьми лет эксплуатации. Вернули фактуру, не испортили швы.',
    date: '2025-10-03',
  },
  {
    author: 'Сергей В.',
    car: 'Bentley Continental GT',
    location: 'Рублёвка',
    rating: 5,
    text: 'Восстановление хрома на решётке радиатора и полировка фар. Работа сделана к обещанному сроку.',
    date: '2025-09-21',
  },
  {
    author: 'Михаил Т.',
    car: 'Range Rover Autobiography',
    location: 'Жуковка',
    rating: 5,
    text: 'Обслуживаем оба автомобиля уже третий год. Предсказуемость сроков и качества — главное.',
    date: '2025-08-15',
  },
];
