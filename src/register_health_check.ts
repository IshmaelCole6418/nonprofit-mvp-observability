import { infrai } from "./infrai_client.ts";

const task = process.env.HEALTHCHECK_URL;
if (!task) throw new Error("HEALTHCHECK_URL is required");
const result = await infrai.cron.create({ cron_expr: "*/5 * * * *", task });
console.log(`health check scheduled: ${result.job_id}`);
