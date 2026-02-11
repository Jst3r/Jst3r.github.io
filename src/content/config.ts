import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    tags: z.array(z.string()).default([]),
    readTime: z.string().default('5 min read'),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  blog,
};
