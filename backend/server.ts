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

  app.use("/graphql", expressMiddleware(server, {
    context: async ({ req, res }) => {
      return await createContext(req, res);
    }
  }));

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
