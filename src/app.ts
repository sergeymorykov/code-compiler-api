import express from "express";
import cors from "cors";
import { config } from "./config.js";
import compileRouter from "./routes/compile.js";

const app = express();

app.use(cors());

app.use(
  express.json({
    limit: config.CODE_SIZE_LIMIT_BYTES + 1024,
    strict: true,
  })
);

app.use(compileRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export function start(): void {
  const port = config.PORT;
  app.listen(port, () => {
    console.log(`Wandbox clone API listening on port ${port}`);
  });
}

export default app;
