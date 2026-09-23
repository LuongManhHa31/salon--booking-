import "dotenv/config";
import { createApp } from "./app";
import { startReminderJob } from "./jobs/reminder";
import { warmUpRetriever } from "./rag/retriever";

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`Salon booking API đang chạy tại http://localhost:${port}`);
  startReminderJob();
  warmUpRetriever();
});
