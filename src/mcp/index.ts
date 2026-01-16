import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import mcpRouter from "./api/mcp.js";

const app = new Hono();

// Middleware
app.use("/*", cors());

// Routes
app.route("/", mcpRouter);

app.get("/health", (c) => c.json({ status: "ok" }));

// Initialize MCP servers on startup

export default app;
