import { timingSafeEqual } from "node:crypto";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { appRouter } from "./trpc";

const SECRET_HEADER = "x-workspace-secret";

export interface CreateAppOptions {
  sharedSecret: string;
}

export function createApp(options: CreateAppOptions): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  const expected = Buffer.from(options.sharedSecret);

  const requireSecret = createMiddleware(async (c, next) => {
    const provided = Buffer.from(c.req.header(SECRET_HEADER) ?? "");
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    await next();
  });

  app.use("/trpc/*", requireSecret);
  app.use("/trpc/*", trpcServer({ router: appRouter }));

  return app;
}
