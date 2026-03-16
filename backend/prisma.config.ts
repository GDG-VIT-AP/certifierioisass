import "dotenv/config";
import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // The CLI strictly needs the direct URL to run migrations/push
    url: env("DIRECT_DATABASE_URL"),
  },
});