/**
 * NormaBot — Crawler Gazzetta Ufficiale
 * ──────────────────────────────────────
 * ZERO dipendenze esterne — usa solo Node.js 20 built-in
 * (fetch nativo, fs, path, https)
 *
 * Prima esecuzione:
 *   1. Crea il file crawler/.env  con:  ANTHROPIC_API_KEY=sk-ant-...
 *   2. node crawler.js
 *
 * Esecuzioni successive:
 *   node crawler.js
 */

import fs   from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CARICA .env MANUALMENTE (no dotenv) ─────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const OUTPUT_PATH = path.join(__dirname, "../public/normative-feed.json");

const KEYWORDS = [
  "edilizia","edilizio","urbanistica","ristrutturazione","CILA","SCIA",
  "permesso di costruire","agibilità","sismabonus","superbonus","ecobonus",
  "bonus barriere","APE","prestazione energetica","efficienza energetica",
  "catasto","sismica","NTC","prevenzione incendi","condono","sanatoria",
  "piano regolatore","SUE","SUAP","appalti pubblici","DPR 380",
];

const CATEGORIE = [
  "Titoli Abilitativi","Bonus Fiscali","Efficienza Energetica",
  "Normativa Strutturale","Appalti Pubblici","Sicurezza",
  "Normativa Regionale","Normativa Professionale",
  "Catasto e Fiscalità Immobiliare",
];

// ─── UTILITY ──────────────────────────────────────────────────────────────────
const sleep  = (ms) => new Promise(r => setTimeout(r, ms));
const log    = (msg, t="info") => console.log(`${{info:"ℹ",ok:"✅",warn:"⚠",error:"❌",step:"→"}[t]||"•"} ${msg}`);
const isRel  = (txt) => KEYWORDS.some(k => txt.toLowerCase().includes(k.toLowerCase()));
const mkId   = (titolo, data) => `gu_${(data||"").replace(/-/g,"")}${titolo.slice(0,20).replace(/\W/g,"").toLowerCase()}`;

function normalizeDate(s) {
  if (!s) return new Date().toISOString().split("T")[0];
  const mesi = {gennaio:1,febbraio:2,marzo:3,aprile:4,maggio:5,giugno:6,luglio:7,agosto:8,settembre:9,ottobre:10,novembre:11,dicembre:12};
  const m1 = s.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (m1 && mesi[m1[2].toLowerCase()]) return `${m1[3]}-${String(mesi[m1[2].toLowerCase()]).padStart(2,"0")}-${m1[1].padStart(2,"0")}`;
  const m2 = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  const m3 = s.match(/\d{4}-\d{2}-\d{2}/);
  if (m3) return m3[0];
  return new Date().toISOString().split("T")[0];
}

// ─── HTTP FETCH CON REDIRECT E TIMEOUT ────────────────────────────────────────
function httpGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || 15000;
    const maxRedirects = options.maxRedirects || 5;

    function doRequest(currentUrl, redirectsLeft) {
      const parsed = new URL(currentUrl);
      const reqOptions = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NormaBot/1.0; studi tecnici IT)",
          "Accept": "application/json, text/html, */*",
          "Accept-Language": "it-IT,it;q=0.9",
          ...options.headers,
        },
      };

      const lib = parsed.protocol === "https:" ? https : (await import("http")).default;
      const req = https.request(reqOptions, (res) => {
        // Gestisci redirect
        if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
          const nextUrl = res.headers.location.startsWith("http")
            ? res.headers.location
            : `${parsed.protocol}//${parsed.hostname}${res.headers.location}`;
          return doRequest(nextUrl, redirectsLeft - 1);
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode} per ${currentUrl}`));
        }

        let data = "";
        res.setEncoding("utf8");
        res.on("data", chunk => data += chunk);
        res.on("end", () => resolve({ data, status: res.statusCode, headers: res.headers }));
      });

      req.setTimeout(timeout, () => { req.destroy(); reject(new Error(`Timeout per ${currentUrl}`)); });
      req.on("error", reject);
      req.end();
    }

    doRequest(url, maxRedirects);
  });
}

// ─── PARSING HTML LEGGERO (senza cheerio) ─────────────────────────────────────
function extractTextBetween(html, startTag, endTag) {
  const results = [];
  let pos = 0;
  while (pos < html.length) {
    const start = html.indexOf(startTag, pos);
    if (start === -1) break;
    const contentStart = start + startTag.length;
    const end = html.indexOf(endTag, contentStart);
    if (end === -1) break;
    const content = html.slice(contentStart, end).replace(/<[^>]+>/g, "").trim();
    if (content) results.push(content);
    pos = end + endTag.length;
  }
  return results;
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ─── FONTE 1: GAZZETTA UFFICIALE JSON API ────────────────────────────────────
async function fetchGazzettaUfficiale(query) {
  const params = new URLSearchParams({
    text: query,
    tipoGazzetta: "GU",
    anno: String(new Date().getFullYear()),
    ricercaEsatta: "false",
    fromIndex: "0",
    toIndex: "15",
  });

  try {
    const url = `https://www.gazzettaufficiale.it/ricerca/json/gazzette?${params}`;
    const res = await httpGet(url, { timeout: 12000 });
    const json = JSON.parse(res.data);
    const items = json.listaRisultati || json.results || json.hits || [];
    log(`GU "${query}": ${items.length} risultati`, "ok");
    return items;
  } catch (err) {
    log(`GU "${query}" fallita: ${err.message}`, "warn");
    return [];
  }
}

function normalizeGuItem(raw) {
  const titolo = (raw.titoloAtto || raw.title || raw.denominazione || raw.descrizione || "").trim();
  const data   = normalizeDate(raw.dataGazzettaString || raw.dataAtto || raw.dataPubblicazione || "");
  const numero = raw.numeroGazzetta ? `GU n.${raw.numeroGazzetta}/${raw.annoPubblicazione||""}` : "";
  return { titolo, data, numero, fonte: "Gazzetta Ufficiale", desc: "" };
}

// ─── FONTE 2: MIT ─────────────────────────────────────────────────────────────
async function fetchMIT() {
  try {
    const res = await httpGet("https://www.mit.gov.it/documentazione/notizie", { timeout: 12000 });
    const html = res.data;

    // Estrai titoli e date con regex semplici
    const titleMatches = html.match(/<h[23][^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/h[23]>/gis) || [];
    const items = [];

    for (const match of titleMatches.slice(0, 20)) {
      const titolo = stripHtml(match);
      if (titolo && isRel(titolo)) {
        items.push({ titolo, data: normalizeDate(""), fonte: "MIT", desc: titolo });
      }
    }

    log(`MIT: ${items.length} risultati rilevanti`, "ok");
    return items.slice(0, 8);
  } catch (err) {
    log(`MIT fallita: ${err.message}`, "warn");
    return [];
  }
}

// ─── FONTE 3: EUR-LEX (normativa UE recepita) ─────────────────────────────────
async function fetchEurLex() {
  try {
    const params = new URLSearchParams({
      type: "quick", value: "edilizia efficienza energetica Italia",
      lang: "it", page: "1",
    });
    const res = await httpGet(`https://eur-lex.europa.eu/search.html?${params}`, { timeout: 12000 });
    const html = res.data;

    const results = [];
    const titleRegex = /<a[^>]+class="[^"]*title[^"]*"[^>]*>(.*?)<\/a>/gis;
    let match;
    while ((match = titleRegex.exec(html)) !== null) {
      const titolo = stripHtml(match[1]).trim();
      if (titolo.length > 20 && isRel(titolo)) {
        results.push({ titolo, data: normalizeDate(""), fonte: "EUR-Lex", desc: titolo });
      }
    }

    log(`EUR-Lex: ${results.length} risultati`, "ok");
    return results.slice(0, 5);
  } catch (err) {
    log(`EUR-Lex fallita: ${err.message}`, "warn");
    return [];
  }
}

// ─── CLASSIFICA CON CLAUDE AI (fetch nativo) ─────────────────────────────────
async function classifyWithClaude(items) {
  if (!ANTHROPIC_API_KEY) {
    log("Chiave API mancante — classificazione AI saltata", "warn");
    return items.map(item => ({
      ...item,
      categoria: "Normativa Generale",
      sommario: item.desc || item.titolo,
      urgenza:  "bassa",
      tag:      [],
      riferimento: item.numero || item.fonte,
    }));
  }

  const prompt = `Analizza questi aggiornamenti normativi italiani. Per ognuno fornisci categoria, sommario (max 2 righe), urgenza (alta/media/bassa) e tag rilevanti per studi tecnici edilizi.

CATEGORIE: ${CATEGORIE.join(", ")}

ELEMENTI:
${items.map((item,i) => `${i+1}. ${item.titolo} [${item.data}] — ${item.fonte}`).join("\n")}

Rispondi SOLO con JSON array (nessun testo aggiuntivo):
[{"indice":1,"categoria":"...","sommario":"...","urgenza":"alta|media|bassa","tag":["..."],"riferimento":"..."}]`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const json = await res.json();
    const text = json.content?.[0]?.text || "[]";
    const clean = text.replace(/```json|```/g, "").trim();
    const classifications = JSON.parse(clean);

    return items.map((item, i) => {
      const cls = classifications.find(c => c.indice === i + 1) || {};
      return {
        ...item,
        categoria:   cls.categoria   || "Normativa Generale",
        sommario:    cls.sommario    || item.desc || item.titolo,
        urgenza:     cls.urgenza     || "bassa",
        tag:         cls.tag         || [],
        riferimento: cls.riferimento || item.numero || item.fonte,
      };
    });
  } catch (err) {
    log(`Classificazione AI fallita: ${err.message}`, "warn");
    return items.map(item => ({
      ...item,
      categoria: "Normativa Generale",
      sommario: item.desc || item.titolo,
      urgenza: "bassa",
      tag: [],
      riferimento: item.numero || item.fonte,
    }));
  }
}

// ─── DEDUPLICAZIONE ────────────────────────────────────────────────────────────
function deduplicate(newItems, existing) {
  const ids     = new Set(existing.map(i => i.id));
  const titoli  = new Set(existing.map(i => i.titolo.toLowerCase().slice(0, 40)));
  return newItems.filter(item => {
    const id  = mkId(item.titolo, item.data);
    const key = item.titolo.toLowerCase().slice(0, 40);
    return !ids.has(id) && !titoli.has(key);
  });
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  NormaBot Crawler — Gazzetta Ufficiale");
  console.log(`  ${new Date().toLocaleString("it-IT")}`);
  console.log(`  API Key: ${ANTHROPIC_API_KEY ? "✅ trovata" : "⚠ non trovata (classificazione AI disabilitata)"}`);
  console.log("═══════════════════════════════════════════════\n");

  // 1. Carica feed esistente
  let existingItems = [];
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      const ex = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
      existingItems = ex.items || [];
      log(`Feed esistente: ${existingItems.length} elementi`, "info");
    } catch { log("Feed esistente non leggibile, parto da zero", "warn"); }
  }

  // 2. Raccogli dati grezzi
  log("Raccolta dati...", "step");
  const rawItems = [];

  const guQueries = [
    "edilizia ristrutturazione",
    "efficienza energetica edifici",
    "sismabonus superbonus",
    "prevenzione incendi edifici",
    "appalti pubblici lavori",
  ];

  for (const q of guQueries) {
    const items = await fetchGazzettaUfficiale(q);
    for (const item of items) {
      const n = normalizeGuItem(item);
      if (n.titolo && isRel(n.titolo)) rawItems.push(n);
    }
    await sleep(600);
  }

  const mitItems = await fetchMIT();
  rawItems.push(...mitItems);
  await sleep(500);

  const euItems = await fetchEurLex();
  rawItems.push(...euItems);

  log(`Totale grezzo: ${rawItems.length} | Nuovi da aggiungere...`, "info");

  // 3. Deduplicazione
  const newItems = deduplicate(
    rawItems.filter(i => i.titolo && isRel(i.titolo)),
    existingItems
  );
  log(`Nuovi elementi unici: ${newItems.length}`, "info");

  // 4. Aggiorna il timestamp anche se non ci sono novità
  if (newItems.length === 0) {
    log("Nessun nuovo elemento. Aggiorno solo il timestamp.", "ok");
    const feed = { lastUpdated: new Date().toISOString(), source: "NormaBot Crawler", items: existingItems };
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(feed, null, 2), "utf-8");
    console.log("\n✅ Completato. Feed invariato.\n");
    return;
  }

  // 5. Classificazione AI in batch
  log("Classificazione AI...", "step");
  const classified = [];
  const batchSize = 5;
  for (let i = 0; i < newItems.length; i += batchSize) {
    const batch = newItems.slice(i, i + batchSize);
    log(`Batch ${Math.floor(i/batchSize)+1}/${Math.ceil(newItems.length/batchSize)}`, "step");
    classified.push(...(await classifyWithClaude(batch)));
    if (i + batchSize < newItems.length) await sleep(800);
  }

  // 6. Costruisci oggetti finali
  const finalItems = classified.map(item => ({
    id:          mkId(item.titolo, item.data),
    data:        item.data,
    titolo:      item.titolo,
    fonte:       item.fonte,
    categoria:   item.categoria,
    tag:         item.tag,
    sommario:    item.sommario,
    urgenza:     item.urgenza,
    riferimento: item.riferimento,
    _crawledAt:  new Date().toISOString(),
  }));

  // 7. Merge e salva (max 100 elementi, più recenti prima)
  const allItems = [...finalItems, ...existingItems]
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .slice(0, 100);

  const feed = {
    lastUpdated: new Date().toISOString(),
    source: "NormaBot Crawler — GU + MIT + EUR-Lex",
    items: allItems,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(feed, null, 2), "utf-8");

  console.log("\n═══════════════════════════════════════════════");
  log(`Elementi totali nel feed: ${allItems.length}`, "ok");
  log(`Nuovi aggiunti: ${finalItems.length}`, "ok");
  log(`Salvato in: ${OUTPUT_PATH}`, "ok");
  console.log("═══════════════════════════════════════════════\n");
}

main().catch(err => {
  log(`Errore fatale: ${err.message}`, "error");
  process.exit(1);
});
