import http from "http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { Server } from "socket.io";
import { connectDatabase } from "./config/db";
import { env } from "./config/env";
import { authRouter } from "./routes/authRoutes";
import { menuRouter } from "./routes/menuRoutes";
import { orderRouter } from "./routes/orderRoutes";
import { paymentRouter } from "./routes/paymentRoutes";
import { rateLimit } from "./middleware/rateLimit";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: env.clientUrl, credentials: true }
});

app.set("io", io);
app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "Al-Arab Restaurant API" });
});

app.use("/api/auth", authRouter);
app.use("/api/menu", menuRouter);
app.use("/api/orders", orderRouter);
app.use("/api/payments", paymentRouter);

io.on("connection", (socket) => {
  socket.emit("connected", { message: "Connected to Al-Arab live orders" });
});

connectDatabase().finally(() => {
  server.listen(env.port, () => {
    console.log(`API running on http://localhost:${env.port}`);
  });
});
