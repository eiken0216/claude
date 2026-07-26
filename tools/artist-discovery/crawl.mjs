#!/usr/bin/env node
// Breadth-first crawl of TikTok accounts via @mentions in video descriptions.
// Dance/music creators collab constantly, so mentions form a dense graph.
import { profile, videoList, videoStats, comments, langMix } from "./tt.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const seeds = process.argv.slice(3);
const ROUNDS = Number(process.argv[2] || 2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const store = existsSync("crawl.json") ? JSON.parse(readFileSync("crawl.json", "utf8")) : {};
const frontier = new Set(seeds.map((s) => s.replace(/^@/, "")));

function mentions(descs) {
  const out = new Set();
  for (const d of descs) {
    for (const m of (d || "").matchAll(/@([A-Za-z0-9_.]{2,24})/g)) {
      const h = m[1].replace(/[._]+$/, "");
      if (h.length >= 3) out.add(h);
    }
  }
  return [...out];
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        try {
          await fn(items[idx], idx);
        } catch {}
      }
    })
  );
}

for (let round = 1; round <= ROUNDS; round++) {
  const todo = [...frontier].filter((h) => !store[h]);
  frontier.clear();
  process.stderr.write(`\n=== round ${round}: ${todo.length} accounts\n`);
  await pool(todo, 4, async (h, i) => {
    if (i % 10 === 0) process.stderr.write(`  ${i}/${todo.length}\n`);
    const p = await profile(h);
    if (p.error) {
      store[h] = { handle: h, error: p.error };
      return;
    }
    const vids = await videoList(h);
    store[h] = { ...p, descs: vids.map((v) => v.desc).slice(0, 15), vids: vids.map((v) => v.id).slice(0, 8) };
    for (const m of mentions(store[h].descs)) if (!store[m]) frontier.add(m);
  });
  writeFileSync("crawl.json", JSON.stringify(store, null, 1));
  process.stderr.write(`discovered so far: ${Object.keys(store).length}, next frontier ${frontier.size}\n`);
}

// leave the un-crawled frontier on disk so a later round can pick it up
writeFileSync("frontier.json", JSON.stringify([...frontier], null, 1));
console.log(`accounts: ${Object.keys(store).length}, pending frontier: ${frontier.size}`);
