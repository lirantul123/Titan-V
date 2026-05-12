import { createApp } from "./app.js";

const port = Number(process.env.PORT) || 3000;
const app = createApp();

app.listen(port, () => {
  console.log(`titan-v-api listening on http://localhost:${port}`);
  console.log(`OpenAPI docs: http://localhost:${port}/docs`);
});
