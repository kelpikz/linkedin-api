import { expect, test } from "bun:test";
import { Hono } from "hono";
import { z } from "zod";

test("foundation dependencies are available", () => {
	const app = new Hono();
	const schema = z.object({ ready: z.boolean() });

	app.get("/health", (context) => context.json(schema.parse({ ready: true })));

	expect(app).toBeInstanceOf(Hono);
	expect(schema.parse({ ready: true })).toEqual({ ready: true });
});
