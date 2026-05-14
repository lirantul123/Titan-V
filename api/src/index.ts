import "dotenv/config";
import { createApp } from "./app.js";
import { isSupabaseConfigured } from "./lib/supabaseAdmin.js";

const port = Number(process.env.PORT) || 3000;
const app = createApp();

app.listen(port, () => {
  console.log(`titan-v-api listening on http://localhost:${port}`);
  console.log(`OpenAPI docs: http://localhost:${port}/docs`);
  console.log(
    isSupabaseConfigured()
      ? "Supabase: configured (per-user /targets)"
      : "Supabase: not configured — add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to api/.env or set them in the environment",
  );
});
