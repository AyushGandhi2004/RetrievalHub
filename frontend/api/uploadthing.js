/**
 * Uploadthing file router.
 * - Production (Vercel): exported `default` handler is used as a serverless function.
 * - Development: run `npm run dev:api` → starts an Express server on port 3001;
 *   Vite proxies /api/uploadthing → http://localhost:3001.
 */
import { createUploadthing, createRouteHandler } from "uploadthing/express";
import express from "express";
import { fileURLToPath } from "url";

const f = createUploadthing();

export const uploadRouter = {
  pdfUploader: f({
    "application/pdf": { maxFileSize: "25MB", maxFileCount: 1 },
  })
    .middleware(() => ({}))
    .onUploadComplete(() => {}),
};

const routeHandler = createRouteHandler({
  router: uploadRouter,
  config: { token: process.env.UPLOADTHING_TOKEN },
});

// Vercel serverless function export
export default routeHandler;

// Local dev Express server — only starts when this file is run directly
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const app = express();
  app.use("/api/uploadthing", routeHandler);
  app.listen(3001, () =>
    console.log("Uploadthing handler running at http://localhost:3001/api/uploadthing")
  );
}
