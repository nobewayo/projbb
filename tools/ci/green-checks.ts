import fs from "fs";
import crypto from "crypto";
import { setTimeout as sleep } from "timers/promises";
import pg from "pg";
import Redis from "ioredis";
import { io } from "socket.io-client";

type Cfg = ReturnType<typeof loadCfg>;
function loadCfg() {
  const raw = fs.readFileSync(".greenrc.json", "utf8");
  return JSON.parse(raw);
}

async function httpCheck(base: string) {
  const health = await fetch(base + "/healthz");
  const ready = await fetch(base + "/readyz");
  if (!health.ok || !ready.ok) throw new Error("HTTP healthz/readyz failed");
}

async function dbCheck(url: string, query: string, iterations: number, p95ms: number) {
  const pool = new pg.Pool({ connectionString: url });
  const durs: number[] = [];
  try {
    for (let i = 0; i < iterations; i++) {
      const t0 = Date.now();
      await pool.query("EXPLAIN " + query);
      durs.push(Date.now() - t0);
      await sleep(5);
    }
  } finally {
    await pool.end();
  }
  durs.sort((a, b) => a - b);
  const p95 = durs[Math.floor(0.95 * (durs.length - 1))];
  if (p95 > p95ms) throw new Error(`DB EXPLAIN p95 ${p95}ms > ${p95ms}ms`);
}

async function redisCheck(url: string, iterations: number, p95ms: number) {
  const sub = new Redis(url);
  const pub = new Redis(url);
  const chan = "green_check_" + Math.random().toString(36).slice(2);
  const durs: number[] = [];
  await new Promise<void>((res) => sub.subscribe(chan, () => res()));
  sub.on("message", (_c, msg) => {
    const t = Number(msg);
    if (!Number.isNaN(t)) {
      durs.push(Date.now() - t);
    }
  });
  for (let i = 0; i < iterations; i++) {
    await pub.publish(chan, String(Date.now()));
    await sleep(5);
  }
  await sleep(100);
  await sub.unsubscribe(chan);
  sub.disconnect();
  pub.disconnect();
  durs.sort((a, b) => a - b);
  const p95 = durs[Math.floor(0.95 * (durs.length - 1))] || 9999;
  if (p95 > p95ms) throw new Error(`Redis pub/sub p95 ${p95}ms > ${p95ms}ms`);
}

async function wsCheck(url: string, timeoutMs: number) {
  const socket = io(url, { transports: ["websocket", "polling"], timeout: timeoutMs });
  await new Promise<void>((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("WS timeout")), timeoutMs);
    socket.on("connect", () => {
      clearTimeout(to);
      socket.disconnect();
      resolve();
    });
    socket.on("connect_error", (e) => {
      clearTimeout(to);
      reject(e);
    });
  });
}

async function assetsCheck(list: { url: string; sha256: string }[]) {
  for (const { url, sha256 } of list) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Asset ${url} not 200`);
    const buf = Buffer.from(await res.arrayBuffer());
    const got = crypto.createHash("sha256").update(buf).digest("hex");
    if (got !== sha256) throw new Error(`Asset ${url} sha mismatch`);
  }
}

async function metricsCheck(base: string, path: string) {
  const res = await fetch(base + path);
  if (!res.ok) throw new Error("Metrics endpoint failed");
}

async function main() {
  const cfg: Cfg = loadCfg();

  // Mandatory
  await httpCheck(cfg.http.base);
  await dbCheck(cfg.db.url, cfg.db.explainQuery, cfg.db.iterations, cfg.db.p95ms);
  await redisCheck(cfg.redis.url, cfg.redis.iterations, cfg.redis.p95ms);
  await wsCheck(cfg.ws.url, cfg.ws.timeoutMs);
  await metricsCheck(cfg.http.base, cfg.metrics.path);

  // Optional
  if (cfg.assets?.enabled && cfg.assets.canaries?.length) await assetsCheck(cfg.assets.canaries);
  // plugins and configBus can be wired later when endpoints exist

  console.log("GREEN CHECKS PASSED");
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
