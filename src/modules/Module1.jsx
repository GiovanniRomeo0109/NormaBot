import { useState, useRef, useEffect } from "react";
import { checkScope, OUT_OF_SCOPE_MESSAGE } from "../guardrails";

const PROXY_URL = import.meta.env.VITE_PROXY_URL || "http://localhost:3001/api/claude";

const SYSTEM_PROMPT = `Sei NormaBot, un agente AI specializzato nella normativa edilizia italiana, creato per assistere professionisti tecnici (ingegneri, architetti, geometri).

Il tuo compito principale è aiutare a determinare il corretto titolo abilitativo edilizio e orientare il professionista nella burocrazia edilizia italiana.

## NORMATIVA DI RIFERIMENTO AGGIORNATA

### Titoli Abilitativi (D.P.R. 380/2001 e successive modifiche, incluso Salva Casa 2024 - D.L. 69/2024 conv. L. 105/2024)

**ATTIVITÀ EDILIZIA LIBERA (senza titolo, max comunicazione)**
- Manutenzione ordinaria (art. 6 TUE)
- Opere di pavimentazione e finitura esterna
- Pannelli solari e fotovoltaici aderenti al tetto
- Aree ludiche senza attrezzature fisse
- Interventi su pertinenze di minore rilevanza (es. tende da sole)
- Opere temporanee per attività di ricerca
- Serre mobili stagionali senza strutture murarie

**CILA - Comunicazione di Inizio Lavori Asseverata (art. 6-bis TUE)**
- Manutenzione straordinaria senza alterazione dei parametri urbanistici e senza interventi su parti strutturali
- Restauro e risanamento conservativo (parti non strutturali)
- Interventi NON rientranti in edilizia libera, SCIA o Permesso di Costruire
- Varianti a SCIA che non incidono su parametri strutturali o urbanistici
- IMPORTANTE (Salva Casa 2024): per la CILA la difformità parziale non blocca più la pratica

**SCIA - Segnalazione Certificata di Inizio Attività (art. 22 TUE)**
- Manutenzione straordinaria con alterazione della volumetria o modifica destinazione d'uso
- Restauro e risanamento conservativo che alterano l'organismo edilizio
- Ristrutturazione edilizia leggera (senza aumento volumetrico, senza modifiche a prospetti in zone vincolate)
- Varianti a Permesso di Costruire che non incidono sui parametri essenziali

**SCIA in alternativa a Permesso di Costruire (art. 23 TUE)**
- Ristrutturazione edilizia che porta a un organismo edilizio in tutto o in parte diverso
- Nuove costruzioni in diretta esecuzione di strumenti urbanistici attuativi

**PERMESSO DI COSTRUIRE (art. 10 TUE)**
- Nuova costruzione
- Ristrutturazione urbanistica
- Ristrutturazione edilizia pesante: modifiche a volumetria, sagoma, prospetti, numero unità in zone vincolate
- Cambio di destinazione d'uso con opere in zona A (centri storici)

### SALVA CASA 2024 (D.L. 69/2024 conv. L. 105/2024) - Novità Principali
- Tolleranze costruttive: fino al 2% per >500mq, 3% per 300-500mq, 4% per 100-300mq, 5% per <100mq
- Cambio destinazione d'uso semplificato nei Comuni capoluogo: SCIA invece di PdC
- Sanatoria parziale: difformità parziali non bloccano la compravendita
- Stato legittimo: basta il titolo dell'ultimo intervento

### VINCOLI CHE MODIFICANO IL TITOLO
- Zone A (centri storici): regime più restrittivo, spesso PdC anche per interventi normalmente in SCIA
- Immobili vincolati (Codice Beni Culturali): nulla osta Soprintendenza sempre necessario
- Zone di rispetto: verificare NTA del PRG

## COME RISPONDERE
1. Analizza: tipo intervento, zona urbanistica, presenza vincoli, regione/comune se forniti
2. Indica il titolo abilitativo con riferimento normativo preciso
3. Segnala se ci sono elementi da verificare localmente
4. Cita il Salva Casa 2024 quando rilevante
5. Avverti sui vincoli anche se non menzionati
6. Formato: strutturato, con titolo in evidenza, motivazione, note e avvertenze
7. Disclaimer: l'analisi è orientativa, la responsabilità professionale rimane al tecnico firmatario

Rispondi SEMPRE in italiano. Tono professionale ma chiaro.`;

const QUICK_QUESTIONS = [
  "Rifaccio il bagno cambiando la disposizione degli impianti. Serve un titolo?",
  "Voglio aprire una porta in un muro interno portante. CILA o SCIA?",
  "Cambio destinazione d'uso da ufficio ad abitazione senza opere. Cosa serve?",
  "Costruisco un gazebo in giardino di 20mq. Che titolo serve?",
  "Voglio rifare la facciata con cappotto termico. Centro storico.",
  "Ristrutturazione completa con cambio planimetria interna. Nessun vincolo.",
];

function TypingIndicator({ checking }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px" }}>
      {checking && <span style={{ fontSize: 10, color: "rgba(201,168,76,0.6)", fontFamily: "'Syne',sans-serif", letterSpacing: 1 }}>Verifico pertinenza...</span>}
      {[0, 0.2, 0.4].map((delay, i) => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: "#C9A84C", display: "inline-block",
          animation: `bounceTyping 1.2s infinite`, animationDelay: `${delay}s`
        }} />
      ))}
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex", flexDirection: isUser ? "row-reverse" : "row",
      alignItems: "flex-start", gap: 12, marginBottom: 20,
      animation: "msgFadeIn 0.3s ease-out"
    }}>
      {!isUser && (
        <div style={{
          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, #C9A84C, #8B6914)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, boxShadow: "0 2px 8px rgba(201,168,76,0.3)"
        }}>⚖️</div>
      )}
      <div style={{
        maxWidth: "76%",
        background: isUser ? "linear-gradient(135deg, #1a3a5c, #0f2a47)" : "rgba(255,255,255,0.04)",
        border: isUser ? "1px solid rgba(201,168,76,0.3)" : "1px solid rgba(255,255,255,0.07)",
        borderRadius: isUser ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
        padding: "11px 15px",
      }}>
        <p style={{
          margin: 0, color: isUser ? "#e8d5a3" : "#d4dde8",
          fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap",
          fontFamily: "'Crimson Pro', Georgia, serif", letterSpacing: 0.15
        }}>{msg.content}</p>
        <span style={{
          display: "block", marginTop: 5, fontSize: 10,
          color: "rgba(255,255,255,0.25)", textAlign: isUser ? "left" : "right",
        }}>{msg.time}</span>
      </div>
      {isUser && (
        <div style={{
          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, #1a3a5c, #0d2440)",
          border: "1px solid rgba(201,168,76,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15
        }}>👤</div>
      )}
    </div>
  );
}

export default function Module1() {
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "Buongiorno! Sono NormaBot, il tuo assistente per la normativa edilizia italiana.\n\nPosso aiutarti a determinare il titolo abilitativo corretto (Edilizia Libera, CILA, SCIA, Permesso di Costruire), orientarti sul Salva Casa 2024, e verificare i vincoli applicabili.\n\nDescrivimi l'intervento che vuoi realizzare — più dettagli fornisci (tipo di edificio, zona urbanistica, presenza di vincoli, comune/regione), più precisa sarà la mia analisi.",
    time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false); // guardrail in corso
  const [showQuick, setShowQuick] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading || checking) return;
    const now = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

    // Mostra subito il messaggio utente
    setMessages(prev => [...prev, { role: "user", content: userText, time: now }]);
    setInput("");
    setShowQuick(false);

    // ── Guardrail: verifica scope prima di chiamare il modello principale ──
    setChecking(true);
    const scope = await checkScope(userText);
    setChecking(false);

    if (scope === "OUT_OF_SCOPE") {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: OUT_OF_SCOPE_MESSAGE,
        time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
        isGuardrail: true,
      }]);
      return;
    }

    // ── Domanda in scope: chiama il modello principale ──
    setLoading(true);
    try {
      const history = [...messages, { role: "user", content: userText }];
      const res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: history.map(m => ({ role: m.role, content: m.content }))
        })
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Errore nella risposta.";
      setMessages(prev => [...prev, { role: "assistant", content: reply, time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Errore di connessione. Riprova.", time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) }]);
    }
    setLoading(false);
  };

  return (
    <>
      <style>{`
        @keyframes bounceTyping { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        @keyframes msgFadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        textarea { resize:none; outline:none; }
      `}</style>
      <div style={{
        display: "flex", flexDirection: "column", height: "100%",
        background: "linear-gradient(160deg, #070d14 0%, #0b1929 60%, #08141f 100%)",
        position: "relative", overflow: "hidden"
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `radial-gradient(ellipse at 20% 20%, rgba(201,168,76,0.05) 0%, transparent 50%),
            linear-gradient(rgba(201,168,76,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(201,168,76,0.025) 1px, transparent 1px)`,
          backgroundSize: "100% 100%, 60px 60px, 60px 60px", pointerEvents: "none"
        }} />

        {/* Header */}
        <div style={{
          padding: "14px 24px", borderBottom: "1px solid rgba(201,168,76,0.1)",
          background: "rgba(7,13,20,0.7)", backdropFilter: "blur(20px)",
          display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 5
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#e8d5a3" }}>Chat Normativa</div>
            <div style={{ fontSize: 10, color: "rgba(201,168,76,0.6)", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 1 }}>
              Modulo 1 · CILA · SCIA · Permesso di Costruire
            </div>
          </div>
          <div style={{ fontSize: 10, color: "rgba(201,168,76,0.5)", textAlign: "right" }}>
            <div>Base normativa aggiornata</div>
            <div style={{ color: "#C9A84C", fontWeight: 600 }}>D.P.R. 380/2001 + Salva Casa 2024</div>
          </div>
        </div>

        {/* Warning bar */}
        <div style={{
          padding: "7px 24px", background: "rgba(201,168,76,0.06)",
          borderBottom: "1px solid rgba(201,168,76,0.09)",
          fontSize: 11, color: "rgba(201,168,76,0.6)", position: "relative", zIndex: 5
        }}>
          ⚠️ Le risposte sono orientative. La responsabilità professionale rimane al tecnico firmatario.
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", position: "relative", zIndex: 4 }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
            {(loading || checking) && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #C9A84C, #8B6914)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⚖️</div>
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "4px 16px 16px 16px" }}>
                  <TypingIndicator checking={checking} />
                </div>
              </div>
            )}
            {showQuick && messages.length === 1 && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 2, textAlign: "center", marginBottom: 10 }}>Domande frequenti</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {QUICK_QUESTIONS.map((q, i) => (
                    <button key={i} onClick={() => sendMessage(q)} style={{
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,168,76,0.14)",
                      borderRadius: 9, padding: "9px 13px", color: "rgba(212,221,232,0.65)",
                      fontSize: 12, fontFamily: "'Crimson Pro', Georgia, serif",
                      cursor: "pointer", textAlign: "left", lineHeight: 1.5, transition: "all 0.2s"
                    }}
                      onMouseEnter={e => { e.target.style.background = "rgba(201,168,76,0.08)"; e.target.style.borderColor = "rgba(201,168,76,0.3)"; e.target.style.color = "#e8d5a3"; }}
                      onMouseLeave={e => { e.target.style.background = "rgba(255,255,255,0.03)"; e.target.style.borderColor = "rgba(201,168,76,0.14)"; e.target.style.color = "rgba(212,221,232,0.65)"; }}
                    >{q}</button>
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div style={{ padding: "14px 24px 18px", borderTop: "1px solid rgba(201,168,76,0.09)", background: "rgba(7,13,20,0.85)", backdropFilter: "blur(20px)", position: "relative", zIndex: 5 }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <div style={{
              display: "flex", gap: 10, background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(201,168,76,0.18)", borderRadius: 12, padding: "9px 12px", alignItems: "flex-end"
            }}>
              <textarea rows={2} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Descrivi l'intervento edilizio... (es: 'Soppalco in appartamento zona B, nessun vincolo')"
                style={{ flex: 1, background: "transparent", border: "none", color: "#d4dde8", fontSize: 13.5, fontFamily: "'Crimson Pro', Georgia, serif", lineHeight: 1.6 }}
              />
              <button onClick={() => sendMessage()} disabled={loading || !input.trim()} style={{
                width: 36, height: 36, borderRadius: 9, border: "none",
                background: loading || !input.trim() ? "rgba(201,168,76,0.12)" : "linear-gradient(135deg, #C9A84C, #8B6914)",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                boxShadow: loading || !input.trim() ? "none" : "0 2px 10px rgba(201,168,76,0.28)", transition: "all 0.2s"
              }}>↑</button>
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", marginTop: 6, paddingLeft: 2 }}>Invio per inviare · Shift+Invio per andare a capo</div>
          </div>
        </div>
      </div>
    </>
  );
}
