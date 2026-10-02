import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const daily = sqliteTable('daily', { id: text('id').primaryKey(), date: text('date').notNull().unique(), row: text('row').notNull(), raw: text('raw').notNull(), locked: integer('locked').notNull().default(0) });
export const board = sqliteTable('board', { id: text('id').primaryKey(), state: text('state').notNull() });

// Separate observed data from the initial weather-model experiment.
export const dailyObservations=sqliteTable('daily_observations',{id:text('id').primaryKey(),date:text('date').notNull().unique(),row:text('row').notNull(),raw:text('raw').notNull(),locked:integer('locked').notNull().default(0)});
export const boardObservations=sqliteTable('board_observations',{id:text('id').primaryKey(),state:text('state').notNull()});
