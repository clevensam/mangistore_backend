import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient().$extends({
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
