// ─────────────────────────────────────────────────────────────────
//  NormaBot — Guardrail di scope (solo Modulo 1 - Chat Normativa)
//  Classifica ogni input utente prima di inviarlo al modello.
// ─────────────────────────────────────────────────────────────────

const PROXY_URL = import.meta.env.VITE_PROXY_URL || "http://localhost:3001/api/claude";

// ── Messaggio di rifiuto gentile mostrato quando la domanda è fuori scope ──
export const OUT_OF_SCOPE_MESSAGE =
`Grazie per la domanda, ma non rientra nelle mie competenze specialistiche. 🏛️

Sono NormaBot e mi occupo esclusivamente di:

• **Titoli abilitativi** — CILA, SCIA, Permesso di Costruire, Edilizia Libera
• **Normativa edilizia italiana** — D.P.R. 380/2001, Salva Casa 2024, Regolamenti edilizi
• **Vincoli urbanistici** — paesaggistici, sismici, centri storici, beni culturali
• **Bonus fiscali edilizi** — Superbonus, Ecobonus, Sismabonus, Bonus Barriere 75%
• **Efficienza energetica** — APE, certificazione energetica, EPBD
• **Professione tecnica** — obblighi, asseverazioni e responsabilità di ingegneri, architetti e geometri
• **Fiscalità immobiliare** — catasto, imposte su compravendita, agevolazioni prima casa

Prova a riformulare la tua domanda in ambito edilizio o urbanistico — sarò felice di aiutarti! 🏗️`;

// ── System prompt del classificatore (leggero, max_tokens: 10) ──
const GUARDRAIL_SYSTEM = `Sei un classificatore di pertinenza per NormaBot, agente specializzato in normativa edilizia italiana.

SCOPE CONSENTITO (rispondi IN_SCOPE):
- Normativa edilizia e urbanistica italiana (CILA, SCIA, PdC, D.P.R. 380/2001, Salva Casa 2024)
- Titoli abilitativi e pratiche edilizie
- Vincoli urbanistici (paesaggistici, sismici, centri storici, beni culturali, PRG, NTA)
- Bonus fiscali edilizi (Superbonus, Ecobonus, Sismabonus, Bonus Barriere)
- Efficienza energetica, APE, certificazione energetica
- Abusi edilizi, sanatorie, accertamento di conformità
- Professione tecnica: ingegneri, architetti, geometri, asseverazioni, responsabilità professionale
- Fiscalità immobiliare: catasto, imposte su immobili, agevolazioni prima casa
- Normativa strutturale e sismica (NTC 2018)
- BIM, sicurezza cantieri in ambito edilizio (D.Lgs. 81/2008)
- Contratti d'appalto e capitolati edilizi
- Qualsiasi argomento direttamente correlato all'edilizia, costruzione o urbanistica

FUORI SCOPE (rispondi OUT_OF_SCOPE) — esempi:
- Cucina, sport, intrattenimento, hobby
- Medicina, salute, farmaci
- Politica, notizie generiche, attualità non edilizia
- Matematica o informatica non applicate all'edilizia
- Qualsiasi argomento non correlato all'edilizia o alla professione tecnica

Rispondi SOLO con una di queste due stringhe esatte, nient'altro:
IN_SCOPE
OUT_OF_SCOPE`;

/**
 * Classifica se il testo è pertinente allo scope di NormaBot.
 * In caso di errore lascia sempre passare (fail-open).
 * @param {string} text
 * @returns {Promise<"IN_SCOPE"|"OUT_OF_SCOPE">}
 */
export async function checkScope(text) {
  try {
    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 10,
        system:     GUARDRAIL_SYSTEM,
        messages:   [{ role: "user", content: text }],
      }),
    });
    if (!res.ok) return "IN_SCOPE";
    const data = await res.json();
    const verdict = data.content?.[0]?.text?.trim().toUpperCase();
    return verdict === "OUT_OF_SCOPE" ? "OUT_OF_SCOPE" : "IN_SCOPE";
  } catch {
    return "IN_SCOPE"; // Fail-open: errore di rete non blocca l'utente
  }
}
