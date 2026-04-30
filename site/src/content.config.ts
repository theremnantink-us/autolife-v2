// site/src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: z.object({
    slug: z.string(),
    name: z.string(),
    category: z.enum(['Мойка', 'Детейлинг', 'Шиномонтаж']),
    price_from: z.number().int().positive(),
    price_to: z.number().int().positive().optional(),
    duration_hours: z.number().positive(),
    warranty_months: z.number().int().optional(),
    materials: z.array(z.string()).default([]),
    hero_image: z.string(),
    short_description: z.string(),
    order: z.number().int(),
  }),
});

export const collections = { services };
