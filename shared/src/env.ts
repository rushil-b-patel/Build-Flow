const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

let loaded = false;

export function loadEnv() {
  if (!loaded) {
    const envFiles = [
      path.resolve(process.cwd(), ".env.shared"),
      path.resolve(process.cwd(), "../.env.shared"),
      path.resolve(process.cwd(), ".env"),
    ];

    for (const envFile of envFiles) {
      if (fs.existsSync(envFile)) {
        dotenv.config({ path: envFile, override: true });
      }
    }

    loaded = true;
  }
}

export function requireEnv(name: string) {
  loadEnv();

  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}
