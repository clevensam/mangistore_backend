import { PrismaClient } from '@prisma/client';

// Supabase pooler connections REQUIRE pgbouncer=true so Prisma's interactive
// $transaction works: it disables the prepared-statement cache and lets Prisma
// pin a connection per transaction. We enforce it here so the URL is correct
// regardless of how DATABASE_URL is configured in the deployment environment.
function buildDatabaseUrl(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  const url = new URL(databaseUrl);
  if (!url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', 'require');
  }
  if (!url.searchParams.has('pgbouncer')) {
    url.searchParams.set('pgbouncer', 'true');
  }
  return url.toString();
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: buildDatabaseUrl(process.env.DATABASE_URL) },
  },
}).$extends({
  result: {
    product: {
      buying_price: {
        compute(value) {
          return value.buying_price ? value.buying_price.toNumber() : null;
        },
      },
      selling_price: {
        compute(value) {
          return value.selling_price ? value.selling_price.toNumber() : null;
        },
      },
    },
    sale: {
      total_price: {
        compute(value) {
          return value.total_price.toNumber();
        },
      },
    },
    debt: {
      amount: {
        compute(value) {
          return value.amount.toNumber();
        },
      },
      amount_paid: {
        compute(value) {
          return value.amount_paid.toNumber();
        },
      },
    },
    debtPayment: {
      amount: {
        compute(value) {
          return value.amount.toNumber();
        },
      },
    },
    operatingExpense: {
      amount: {
        compute(value) {
          return value.amount.toNumber();
        },
      },
    },
  },
});

export default prisma;
