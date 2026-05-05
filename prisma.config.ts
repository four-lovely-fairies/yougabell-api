import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 — connection URLs live here, not in schema.prisma.
// - migrations / introspection use this datasource (direct connection, no pgBouncer)
// - runtime queries use a driver adapter passed to PrismaClient (see prisma/prisma.service.ts)

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
