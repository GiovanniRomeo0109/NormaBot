// ─────────────────────────────────────────────────────────────────
//  NormaBot — Proxy Backend
//  Locale:      http://localhost:3001
//  Produzione:  Railway (variabile FRONTEND_URL nel dashboard)
// ─────────────────────────────────────────────────────────────────

import express from "express";
import cors    from "cors";
import fetch   from "node-fetch";
import dotenv  from "dotenv";

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3001;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.warn("⚠️  ANTHROPIC_API_KEY mancante — le chiamate AI restituiranno errore 503");
}

// CORS dinamico: accetta localhost in sviluppo + dominio Vercel in produzione
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  process.env.FRONTEND_URL,          // es. https://normabot.vercel.app
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Permetti richieste senza origin (es. curl, Postman)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS bloccato per: ${origin}`));
  }
}));

app.use(express.json({ limit: "2mb" }));

// ── Health check ───────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status:    "ok",
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || "development",
    apiKey:    ANTHROPIC_API_KEY ? "configurata ✅" : "MANCANTE ⚠️",
  });
});

// ── Proxy principale → Anthropic /v1/messages ──────────────────────
app.post("/api/claude", async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "ANTHROPIC_API_KEY non configurata sul server. Aggiungila nelle variabili d'ambiente di Railway." });
  }
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta":    "web-search-2025-03-05",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic error:", data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n✅  NormaBot proxy attivo su http://localhost:${PORT}`);
  console.log(`    Origin consentite: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`    → https://api.anthropic.com/v1/messages\n`);
});
