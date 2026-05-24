import "dotenv/config";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
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
    plugins: [ApolloServerPluginLandingPageLocalDefault()],
  });

  await server.start();

  try {
    await verifyEmailConfig();
    console.log('Email server is ready');
  } catch (err) {
    console.warn('Email server not available — OTP emails will not be sent:', (err as Error).message);
  }

  app.use(
    "/graphql",
    (req, _res, next) => {
      req.body = req.body || {};
      next();
    },
    bodyParser.json(),
    expressMiddleware(server, {
      context: async ({ req, res }) => createContext(req, res),
    }),
  );

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Server is running with GraphQL API" });
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
