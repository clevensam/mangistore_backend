import "dotenv/config";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import bodyParser from "body-parser";
import prisma from "./prisma";
import { typeDefs } from "./graphql/typeDefs";
import { authResolvers } from "./graphql/resolvers/auth";
import { productResolvers } from "./graphql/resolvers/products";
import { customerResolvers } from "./graphql/resolvers/customers";
import { debtResolvers } from "./graphql/resolvers/debts";
import { expenseResolvers } from "./graphql/resolvers/expenses";
import { analysisResolvers } from "./graphql/resolvers/analysis";
import { dashboardResolvers } from "./graphql/resolvers/dashboard";
import { createContext } from "./auth/context";
import { verifyEmailConfig } from "./services/email";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(bodyParser.json());

const resolvers = {
  Query: {
    ...authResolvers.Query,
    ...productResolvers.Query,
    ...customerResolvers.Query,
    ...debtResolvers.Query,
    ...expenseResolvers.Query,
    ...analysisResolvers.Query,
    ...dashboardResolvers.Query
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...productResolvers.Mutation,
    ...customerResolvers.Mutation,
    ...debtResolvers.Mutation,
    ...expenseResolvers.Mutation
  },
  OperatingExpense: expenseResolvers.OperatingExpense,
  ExpenseCategoryTotal: expenseResolvers.ExpenseCategoryTotal
};

async function startServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  await server.start();

  try {
    await verifyEmailConfig();
    console.log('Email server is ready');
  } catch (err) {
    console.warn('Email server not available — OTP emails will not be sent:', (err as Error).message);
  }

  app.use("/graphql", expressMiddleware(server, {
    context: async ({ req, res }) => {
      return await createContext(req, res);
    }
  }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Server is running with GraphQL API" });
  });

  app.get("/api/debug/email-env", (req, res) => {
    res.json({
      EMAIL_HOST: process.env.EMAIL_HOST ? 'set' : 'MISSING',
      EMAIL_PORT: process.env.EMAIL_PORT ? 'set' : 'MISSING',
      EMAIL_USER: process.env.EMAIL_USER ? 'set' : 'MISSING',
      EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? 'set' : 'MISSING',
      DEFAULT_FROM_EMAIL: process.env.DEFAULT_FROM_EMAIL ? 'set' : 'MISSING',
    });
  });

  app.get("/api/debug/email-test", async (req, res) => {
    try {
      await verifyEmailConfig();
      res.json({ ok: true, message: 'SMTP connection works' });
    } catch (err) {
      const error = err as Error;
      res.json({ ok: false, message: error.message, code: (error as any).code });
    }
  });

  app.use(errorHandler);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

startServer()
  .catch(async (e) => {
    console.error('Failed to start server:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
