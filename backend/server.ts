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
import { resolve4 } from "dns/promises";
import nodemailer from "nodemailer";
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
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    let ips: string[] = [];
    try {
      ips = await resolve4(host);
    } catch (e) {
      return res.json({ dns_error: (e as Error).message, note: 'trying raw socket test instead' });
    }

    if (ips.length === 0) {
      return res.json({ error: 'no IPv4 addresses resolved' });
    }

    const results: any = { resolved: ips };
    for (const ip of ips.slice(0, 2)) {
      for (const port of [587, 465]) {
        const key = `${ip}:${port}`;
        try {
          const t = nodemailer.createTransport({
            host: ip,
            port,
            secure: port === 465,
            auth: {
              user: process.env.EMAIL_USER || '',
              pass: process.env.EMAIL_PASSWORD || '',
            },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            tls: { rejectUnauthorized: false },
          });
          await t.verify();
          results[key] = { ok: true };
        } catch (err) {
          const error = err as Error;
          results[key] = { ok: false, message: error.message, code: (error as any).code };
        }
      }
    }
    res.json(results);
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
