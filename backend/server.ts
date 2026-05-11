import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import bodyParser from "body-parser";
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

const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(cookieParser());
app.use("/graphql", loginRateLimiter);
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

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("auth_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict"
    });
    res.json({ success: true });
  });

  app.use(errorHandler);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

startServer();