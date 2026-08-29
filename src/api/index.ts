import { app } from "./app.ts";

const port = Number(Bun.env.PORT || 3000);
const server = Bun.serve({ port, fetch: app.fetch });

console.log(`LinkedIn profile API listening on http://localhost:${server.port}`);
