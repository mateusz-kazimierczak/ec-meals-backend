import { onTestFinished } from "vitest";
import { buildApp } from "../../src/app.js";

export const buildTestApp = async () => {
  const app = buildApp({ logger: false });
  await app.ready();
  onTestFinished(async () => {
    await app.close();
  });
  return app;
};
