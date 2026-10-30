// npm run dev: netlify dev with the secrets in .env.dev, which it doesn't load by itself
import { spawn } from "node:child_process";

try { process.loadEnvFile(".env.dev"); } catch { console.log("No .env.dev found. Setlist sync won't work; see .env.example."); }
spawn("npx netlify dev", { stdio: "inherit", shell: true }).on("exit", (code) => process.exit(code ?? 0));
