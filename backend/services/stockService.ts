import prisma from '../prisma';

// The client used for all DB access: either the global prisma instance or an
// interactive-transaction client. Typed loosely because the extended prisma client
// exposes result extensions that Prisma.TransactionClient does not structurally include.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

interface SheetEntry {
  product_id: string;
  weekday: number;
  in: number;
  jumla: number;
  uza: number;
  baki: number;
}

/**
 * Single source of truth model:
 *  - The weekly stock-sheet (StockEntry) holds IN/Jumla/UZA/Baki.
 *  - UZA (sold qty) is the source of the `Sale` records used by the dashboard
 *    and analytics. `Sale` rows are derived per (product, weekday).
 *  - `products.quantity` is synced to the latest saved Baki (remaining stock).
 *  - POS checkouts append to the `Order` table (checkout-count source).
 *
 * Every mutating helper accepts a transaction client (`db`) so callers can run
 * the whole flow atomically via prisma.$transaction.
 */

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function mondayOf(date: Date): Date {
  const d = startOfDay(date);
  const jsDay = d.getDay();
  const diff = jsDay === 0 ? 6 : jsDay - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

export function weekdayIndexOf(date: Date): number {
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isoOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Latest saved Baki per product (from the most recent week, last recorded weekday).
export async function latestBakiMap(ownerId: string, db: Tx = prisma): Promise<Record<string, number>> {
  const latest = await db.stockEntry.findFirst({
    where: { owner_id: ownerId },
    orderBy: { week_date: 'desc' },
    select: { week_date: true },
  });
  if (!latest) return {};

  const entries: SheetEntry[] = await db.stockEntry.findMany({
    where: { owner_id: ownerId, week_date: latest.week_date },
    orderBy: [{ weekday: 'desc' }, { product_id: 'asc' }],
  });

  const seen = new Set<string>();
  const map: Record<string, number> = {};
  for (const e of entries) {
    if (seen.has(e.product_id)) continue;
    seen.add(e.product_id);
    map[e.product_id] = e.baki;
  }
  return map;
}

// Rebuild the `Sale` table for a given week from the sheet's UZA.
// One Sale per (product, weekday) at selling price x UZA. Rows with UZA 0 are removed.
// Batched: delete the week's sales, then createMany the planned rows (2 queries).
export async function deriveSalesForWeek(ownerId: string, weekStart: Date, db: Tx = prisma): Promise<void> {
  const end = addDays(weekStart, 7);

  const entries: SheetEntry[] = await db.stockEntry.findMany({
    where: { owner_id: ownerId, week_date: weekStart },
  });

  const products = await db.product.findMany({
    where: { owner_id: ownerId },
    select: { id: true, selling_price: true },
  });
  const priceById: Record<string, number> = {};
  products.forEach((p: any) => {
    priceById[p.id] = Number(p.selling_price) || 0;
  });

  const planned = entries
    .filter((e) => e.uza > 0)
    .map((e) => ({
      owner_id: ownerId,
      product_id: e.product_id,
      quantity: e.uza,
      total_price: (priceById[e.product_id] || 0) * e.uza,
      created_at: addDays(weekStart, e.weekday),
    }));

  // Remove the previous derived sales for this week (planned rows are recreated below).
  await db.sale.deleteMany({
    where: { owner_id: ownerId, created_at: { gte: weekStart, lt: end } },
  });

  if (planned.length) {
    await db.sale.createMany({ data: planned });
  }
}

// Sync products.quantity to the latest saved Baki per product.
// Uses a single bulk UPDATE (unnest) instead of one UPDATE per product, which
// was N sequential round-trips over the Supabase pooler.
export async function syncProductQuantities(ownerId: string, db: Tx = prisma): Promise<void> {
  const baki = await latestBakiMap(ownerId, db);
  const entries = Object.entries(baki);
  if (!entries.length) return;

  const ids = entries.map(([id]) => id);
  const quantities = entries.map(([, q]) => q);

  await db.$executeRaw`
    UPDATE products p
    SET quantity = v.q
    FROM (SELECT unnest(${ids}::text[]) AS id, unnest(${quantities}::int[]) AS q) v
    WHERE p.id = v.id AND p.owner_id = ${ownerId}
  `;
}

// Load the current week's sheet for a product as a 7-length array of DaySlots.
export async function getProductWeekDays(
  ownerId: string,
  weekStart: Date,
  productId: string,
  db: Tx = prisma,
): Promise<Array<{ in: number; jumla: number; uza: number; baki: number }>> {
  const entries: SheetEntry[] = await db.stockEntry.findMany({
    where: { owner_id: ownerId, week_date: weekStart, product_id: productId },
  });
  const days = Array.from({ length: 7 }, () => ({ in: 0, jumla: 0, uza: 0, baki: 0 }));
  entries.forEach((e) => {
    if (e.weekday >= 0 && e.weekday < 7) {
      days[e.weekday] = { in: e.in, jumla: e.jumla, uza: e.uza, baki: e.baki };
    }
  });
  return days;
}

// Recompute Jumla/Baki cascade for a product's 7-day week (this week is independent,
// Day 0 Jumla = IN). Returns the updated days array.
export function recomputeWeekDays(
  days: Array<{ in: number; jumla: number; uza: number; baki: number }>,
): Array<{ in: number; jumla: number; uza: number; baki: number }> {
  const next = days.map((d) => ({ ...d }));
  let prevBaki = 0;
  for (let i = 0; i < 7; i++) {
    const d = next[i];
    d.jumla = Math.max(0, d.in + (i > 0 ? prevBaki : 0));
    d.baki = Math.max(0, d.jumla - d.uza);
    prevBaki = d.baki;
  }
  return next;
}

// Persist a product's full 7-day week to the sheet (bulk delete + createMany).
export async function saveProductWeek(
  ownerId: string,
  weekStart: Date,
  productId: string,
  days: Array<{ in: number; jumla: number; uza: number; baki: number }>,
  db: Tx = prisma,
): Promise<void> {
  await db.stockEntry.deleteMany({
    where: { owner_id: ownerId, week_date: weekStart, product_id: productId },
  });

  await db.stockEntry.createMany({
    data: days.map((d, wd) => ({
      owner_id: ownerId,
      product_id: productId,
      week_date: weekStart,
      weekday: wd,
      in: d.in,
      jumla: d.jumla,
      uza: d.uza,
      baki: d.baki,
    })),
  });
}

// Record a POS checkout (an Order row). Returns its id.
export async function createOrder(ownerId: string, db: Tx = prisma): Promise<string> {
  const order = await db.order.create({ data: { owner_id: ownerId } });
  return order.id;
}

// Persist a full week of entries (report save) within the given client.
// Removes saved entries for products no longer present.
export interface WeekEntryInput {
  productId: string;
  weekday: number;
  in: number;
  jumla: number;
  uza: number;
  baki: number;
}

export async function upsertWeekEntries(
  ownerId: string,
  weekStart: Date,
  entries: WeekEntryInput[],
  productIds: string[],
  db: Tx = prisma,
): Promise<void> {
  const week = new Date(weekStart);
  week.setHours(0, 0, 0, 0);

  // Rebuild the whole week atomically with 2 bulk queries (delete + createMany)
  // instead of one UPSERT round-trip per (product, weekday). Over the Supabase
  // pooler, per-row upserts ran sequentially and blew past the transaction
  // timeout. saveStockSheet always writes the full sheet, so deleting and
  // recreating the entire week is correct (removed products are dropped too).
  await db.stockEntry.deleteMany({
    where: { owner_id: ownerId, week_date: week },
  });

  if (entries.length) {
    await db.stockEntry.createMany({
      data: entries.map((e) => ({
        owner_id: ownerId,
        product_id: e.productId,
        week_date: week,
        weekday: e.weekday,
        in: e.in,
        jumla: e.jumla,
        uza: e.uza,
        baki: e.baki,
      })),
    });
  }
}
