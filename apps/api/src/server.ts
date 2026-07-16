import http from "http";
import crypto from "crypto";
import mongoose from "mongoose";
import cors, { type CorsOptions } from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { Server } from "socket.io";
import { connectDatabase, isDatabaseConnected } from "./config/db";
import { env } from "./config/env";
import { authRouter } from "./routes/authRoutes";
import { menuRouter } from "./routes/menuRoutes";
import { orderRouter } from "./routes/orderRoutes";
import { paymentRouter } from "./routes/paymentRoutes";
import { tableRouter } from "./routes/tableRoutes";
import { staffRouter } from "./routes/staffRoutes";
import { customerRouter } from "./routes/customerRoutes";
import { reportRouter } from "./routes/reportRoutes";
import { settingsRouter } from "./routes/settingsRoutes";
import { accountRouter } from "./routes/accountRoutes";
import { supportRouter } from "./routes/supportRoutes";
import { reviewRouter } from "./routes/reviewRoutes";
import { notificationRouter } from "./routes/notificationRoutes";
import { rateLimit } from "./middleware/rateLimit";
import {
  connectRedis,
  disconnectRedis,
  isRedisConnected
} from "./services/redisService";
import { reportOperationalAlert } from "./services/operationalAlertService";
import {
  findOrderForTracking,
  orderTrackingRoom,
  toPublicOrderTracking,
  trackingCredentialsSchema
} from "./services/orderTrackingService";
import {
  adminAccessCookieName,
  customerAccessCookieName,
  readCookieHeader
} from "./services/authCookieService";
import { verifyAccessToken } from "./services/tokenService";
import {
  canAccessSupportIssue,
  supportRoomCredentialsSchema
} from "./services/supportAccessService";

const app = express();
const server = http.createServer(app);
app.set("trust proxy", env.trustProxyHops);

function isAllowedLocalOrigin(origin: string) {
  if (process.env.NODE_ENV === "production") return false;

  try {
    const url = new URL(origin);
    const { hostname } = url;
    if (["localhost", "127.0.0.1", "::1"].includes(hostname)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;

    const private172Match = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (private172Match) {
      const secondOctet = Number(private172Match[1]);
      return secondOctet >= 16 && secondOctet <= 31;
    }

    return false;
  } catch {
    return false;
  }
}

function isAllowedCorsOrigin(origin?: string) {
  return !origin || origin === env.clientUrl || isAllowedLocalOrigin(origin);
}

const corsOrigin: CorsOptions["origin"] = (origin, callback) => {
  callback(null, isAllowedCorsOrigin(origin));
};

const io = new Server(server, {
  cors: { origin: corsOrigin, credentials: true }
});

app.set("io", io);
app.use(helmet());
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use((req, res, next) => {
  const incomingRequestId = req.header("x-request-id")?.trim();
  const requestId = incomingRequestId && incomingRequestId.length <= 128
    ? incomingRequestId
    : crypto.randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});
app.use(morgan(env.isProduction
  ? ':date[iso] :method :url :status :response-time ms request-id=:res[x-request-id]'
  : "dev"));
app.use(rateLimit(120, 60_000, "global"));
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use("/api/support", express.json({ limit: "6mb" }));
app.use(express.json({
  limit: "1mb",
  verify: (req, _res, buffer) => {
    if ((req as Request).originalUrl === "/api/payments/webhook") {
      (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    }
  }
}));
app.use((error: Error & { status?: number; type?: string }, _req: Request, res: Response, next: NextFunction) => {
  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large" });
  }

  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({ message: "Invalid JSON request body" });
  }

  return next(error);
});
function readinessStatus() {
  const database = isDatabaseConnected() ? "connected" : "disconnected";
  const redis = isRedisConnected() ? "connected" : "disconnected";
  const ready = !env.isProduction || (database === "connected" && redis === "connected");
  return { database, redis, ready };
}

app.get("/api/health/live", (_req, res) => {
  res.json({
    ok: true,
    service: "Al-Arab Restaurant API",
    release: env.releaseSha,
    uptimeSeconds: Math.floor(process.uptime())
  });
});

function sendReadiness(_req: Request, res: Response) {
  const { database, redis, ready } = readinessStatus();
  res.status(ready ? 200 : 503).json({
    ok: ready,
    service: "Al-Arab Restaurant API",
    release: env.releaseSha,
    database,
    redis
  });
}

app.get("/api/health", sendReadiness);
app.get("/api/health/ready", sendReadiness);

app.use("/api/auth", authRouter);
app.use("/api/account", accountRouter);
app.use("/api/menu", menuRouter);
app.use("/api/orders", orderRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/tables", tableRouter);
app.use("/api/staff", staffRouter);
app.use("/api/customers", customerRouter);
app.use("/api/reports", reportRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/support", supportRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/notifications", notificationRouter);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: "Invalid resource identifier" });
  }
  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ message: "Request validation failed" });
  }
  const message = error instanceof Error ? error.message : "Unknown server error";
  const requestId = String(res.locals.requestId ?? "unknown");
  console.error(`Unhandled API error request-id=${requestId}:`, message);
  void reportOperationalAlert({
    event: "unhandled_api_error",
    message,
    requestId,
    route: `${req.method} ${req.path}`
  });
  res.status(500).json({ message: "Internal server error", requestId });
});

io.on("connection", (socket) => {
  const cookieHeader = socket.handshake.headers.cookie;
  const adminSessionToken = readCookieHeader(cookieHeader, adminAccessCookieName);
  const customerSessionToken = readCookieHeader(cookieHeader, customerAccessCookieName);
  const sessionToken = adminSessionToken ?? customerSessionToken;

  if (adminSessionToken) {
    try {
      const payload = verifyAccessToken(adminSessionToken);
      if (payload.role === "admin") socket.join("notifications:admin");
    } catch {
      // An invalid admin cookie must not grant access to the admin room.
    }
  }
  if (customerSessionToken) {
    try {
      const payload = verifyAccessToken(customerSessionToken);
      if (payload.role === "customer") {
        socket.join(`notifications:user:${payload.sub}`);
      }
    } catch {
      // An invalid customer cookie must not grant access to a customer room.
    }
  }

  if (sessionToken) {
    try {
      const payload = verifyAccessToken(sessionToken);
      socket.data.user = { id: payload.sub, role: payload.role };
      if (payload.role === "admin") {
        socket.join("support:admins");
      }
      if (payload.role === "admin" || payload.role === "kitchen") {
        socket.join("orders:staff");
      }
    } catch {
      socket.data.user = undefined;
    }
  }

  socket.emit("connected", { message: "Connected to Al-Arab live orders" });

  socket.on(
    "support:join",
    async (
      credentials: unknown,
      acknowledge?: (result: { ok: boolean; message?: string }) => void
    ) => {
      const respond =
        typeof acknowledge === "function" ? acknowledge : () => undefined;
      const parsed = supportRoomCredentialsSchema.safeParse(credentials);
      if (!parsed.success || socket.rooms.size > 20) {
        respond({ ok: false, message: "Invalid support details" });
        return;
      }

      try {
        const allowed = await canAccessSupportIssue(
          parsed.data.issueId,
          socket.data.user,
          parsed.data.trackingToken
        );
        if (!allowed) {
          respond({ ok: false, message: "Support access denied" });
          return;
        }

        await socket.join(`support:${parsed.data.issueId}`);
        respond({ ok: true });
      } catch {
        respond({ ok: false, message: "Support is temporarily unavailable" });
      }
    }
  );

  socket.on("support:leave", (credentials: unknown) => {
    const parsed = supportRoomCredentialsSchema.safeParse(credentials);
    if (parsed.success) {
      socket.leave(`support:${parsed.data.issueId}`);
    }
  });

  socket.on(
    "order:track",
    async (
      credentials: unknown,
      acknowledge?: (result: {
        ok: boolean;
        order?: ReturnType<typeof toPublicOrderTracking>;
        message?: string;
      }) => void
    ) => {
      const respond =
        typeof acknowledge === "function" ? acknowledge : () => undefined;
      const parsed = trackingCredentialsSchema.safeParse(credentials);
      if (!parsed.success || socket.rooms.size > 20) {
        respond({ ok: false, message: "Invalid tracking details" });
        return;
      }

      try {
        const order = await findOrderForTracking(
          parsed.data.orderNumber,
          parsed.data.trackingToken
        );
        if (!order) {
          respond({ ok: false, message: "Order tracking was not found" });
          return;
        }

        await socket.join(orderTrackingRoom(parsed.data.orderNumber));
        respond({ ok: true, order: toPublicOrderTracking(order) });
      } catch {
        respond({ ok: false, message: "Order tracking is temporarily unavailable" });
      }
    }
  );
});

async function startServer() {
  await connectRedis();
  await connectDatabase();
  server.listen(env.port, () => {
    console.log(`API running on http://localhost:${env.port}`);
  });
}

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Shutting down gracefully.`);

  const forcedExit = setTimeout(() => {
    console.error("Graceful shutdown timed out");
    process.exit(1);
  }, env.shutdownTimeoutMs);
  forcedExit.unref();

  io.close();
  if (server.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await Promise.allSettled([disconnectRedis(), mongoose.disconnect()]);
  clearTimeout(forcedExit);
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error("Unhandled promise rejection:", message);
  void reportOperationalAlert({
    event: "unhandled_rejection",
    message,
    severity: "fatal"
  });
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error.message);
  void reportOperationalAlert({
    event: "uncaught_exception",
    message: error.message,
    severity: "fatal"
  }).finally(() => process.exit(1));
});

void startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(`API startup failed: ${message}`);
  process.exitCode = 1;
});
