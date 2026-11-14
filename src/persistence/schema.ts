import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const architectures = pgTable('architectures', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  latestVersion: integer('latest_version').notNull().default(1),
});

export const architectureVersions = pgTable(
  'architecture_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    architectureId: uuid('architecture_id')
      .notNull()
      .references(() => architectures.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    document: jsonb('document').notNull(),
    validationSummary: jsonb('validation_summary').notNull(),
    changeSource: text('change_source').notNull().default('manual'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('architecture_versions_arch_version_uidx').on(
      table.architectureId,
      table.version,
    ),
  ],
);
