#!/usr/bin/env node
import fs from "node:fs";

const outputPath = process.argv[2] ?? "/etc/nginx/conf.d/00-workers.conf";
const rawWorkers = process.env.NUM_WORKERS ?? "1";
const workers = Number.parseInt(rawWorkers, 10);

if (!Number.isInteger(workers) || workers <= 0) {
  throw new Error(`NUM_WORKERS must be a positive integer: ${rawWorkers}`);
}

const lines = [
  "upstream openfront_workers {",
  "    random;",
  ];
for (let i = 0; i < workers; i++) {
  lines.push(`    server 127.0.0.1:${3001 + i};`);
}
lines.push("}", "", "map $worker $worker_port {", "    default 3001;");
for (let i = 0; i < workers; i++) {
  lines.push(`    ${i} ${3001 + i};`);
}
lines.push("}", "");

fs.writeFileSync(outputPath, lines.join("\n"), "utf8");
