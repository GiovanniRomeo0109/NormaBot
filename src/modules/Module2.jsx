import { useState } from "react";

const PROXY_URL = import.meta.env.VITE_PROXY_URL || "http://localhost:3001/api/claude";

const DOC_TYPES = [
  { id: "assev_cila", label: "Asseverazione CILA", icon: "📋", desc: "Art. 6-bis D.P.R. 380/2001" },
  { id: "assev_scia", label: "Asseverazione SCIA", icon: "📝", desc: "Art. 22-23 D.P.R. 380/2001" },
  { id: "rel_tecnica", label: "Relazione Tecnica", icon: "📐", desc: "Descrittiva dell'intervento" },
  { id: "rel_strutturale", label: "Relazione Strutturale", icon: "🏗️", desc: "Verifica statica e sismica" },
  { id: "ape", label: "Scheda APE (bozza)", icon: "🌿", desc: "Attestato Prestazione Energetica" },
  { id: "sanatoria", label: "Istanza Sanatoria", icon: "⚖️", desc: "Accertamento conformità (Salva Casa 2024)" },
];

const INITIAL_FORM = {
  // Dati professionista
  profNome: "", profCognome: "", profOrdine: "", profNumIscrizione: "", profCF: "",
  // Dati committente
  commNome: "", commCognome: "", commCF: "",
  // Dati immobile
  comune: "", provincia: "", via: "", civico: "", interno: "",
  foglio: "", mappale: "", subalterno: "",
  zonaUrbanistica: "", pianoEdi: "", superficieMq: "",
  vincoli: [], annoCostruzione: "",
  // Dati intervento
  tipoIntervento: "", descrizione: "", superficieIntervento: "",
  importoLavori: "", dataInizioLavori: "",
  // Note aggiuntive
  noteAggiuntive: "",
};

const VINCOLI_OPTIONS = [
  "Nessun vincolo",
  "Zona A - Centro storico",
  "Vincolo paesaggistico (D.Lgs. 42/2004)",
  "Vincolo idrogeologico",
  "Zona sismica 1",
  "Zona sismica 2",
  "Zona sismica 3",
  "Immobile vincolato (Soprintendenza)",
  "Rispetto cimiteriale",
  "Rispetto stradale",
];

function buildSystemPrompt(docType) {
  const baseContext = `Sei un assistente specializzato nella redazione di documenti tecnici edilizi italiani.
Genera documenti professionali, precisi e conformi alla normativa vigente (D.P.R. 380/2001, Salva Casa 2024 D.L. 69/2024 conv. L. 105/2024, D.Lgs. 42/2004).

REGOLE DI FORMATTAZIONE:
- Usa linguaggio tecnico-giuridico formale
- Inserisci riferimenti normativi esatti con articoli di legge
- Struttura il documento con sezioni chiare
- Usa [DATO MANCANTE] per informazioni non fornite ma necessarie
- Includi sempre il disclaimer finale sulla responsabilità del tecnico firmatario
- Formatta il testo con sezioni ben delimitate, pronto per essere copiato e completato
- Scrivi SEMPRE in italiano`;

  const docInstructions = {
    assev_cila: `Genera un'ASSEVERAZIONE per CILA (Comunicazione di Inizio Lavori Asseverata) ai sensi dell'art. 6-bis del D.P.R. 380/2001 e s.m.i.
La struttura deve essere:
1. Intestazione con dati professionista e data
2. Dati del committente
3. Descrizione dell'immobile (dati catastali, ubicazione)
4. Descrizione dettagliata dell'intervento
5. Dichiarazioni asseverate del tecnico (conformità normativa, rispetto PRG, assenza vincoli o loro compatibilità)
6. Attestazione di conformità
7. Luogo, data e spazio per firma/timbro`,

    assev_scia: `Genera un'ASSEVERAZIONE per SCIA (Segnalazione Certificata di Inizio Attività) ai sensi degli artt. 22-23 del D.P.R. 380/2001 e s.m.i.
La struttura deve essere:
1. Intestazione con dati professionista e data
2. Dati del committente e dell'immobile
3. Descrizione dell'intervento con classificazione (art. 22 c.1, c.2 o art. 23)
4. Dichiarazioni di conformità urbanistica e edilizia
5. Conformità alle norme igienico-sanitarie, sicurezza, energetiche
6. Attestazione carichi urbanistici e dotazione standard
7. Firma e timbro`,

    rel_tecnica: `Genera una RELAZIONE TECNICA DESCRITTIVA dell'intervento edilizio.
La struttura deve essere:
1. Oggetto e scopo della relazione
2. Dati generali immobile e riferimenti catastali
3. Stato di fatto: descrizione dell'immobile esistente
4. Descrizione dell'intervento progettato (dettagliata)
5. Opere edili previste
6. Materiali e finiture
7. Impatto su parametri urbanistici (volumetria, superficie, sagoma)
8. Conclusioni`,

    rel_strutturale: `Genera un'INTRODUZIONE e INDICE per RELAZIONE STRUTTURALE ai sensi del D.M. 17/01/2018 (NTC 2018).
La struttura deve essere:
1. Premessa e scopo della relazione
2. Normativa di riferimento (NTC 2018, Eurocodici rilevanti, Circolare 21/01/2019)
3. Dati generali opera e committente
4. Descrizione struttura esistente (se presente)
5. Descrizione intervento strutturale
6. Classificazione sismica del sito e parametri di progetto
7. Indice completo della relazione (da completare)
8. Avvertenza: questa è una bozza da completare con calcoli e verifiche`,

    ape: `Genera una SCHEDA INFORMATIVA per APE (Attestato di Prestazione Energetica) ai sensi del D.Lgs. 192/2005 e s.m.i.
Nota: questa è una bozza di raccolta dati, l'APE definitivo deve essere redatto con software certificato.
La struttura deve essere:
1. Dati identificativi immobile e proprietario
2. Dati geometrici (superficie, volume lordo)
3. Dati sistema involucro (pareti, copertura, pavimento, finestre - trasmittanze da rilevare)
4. Impianti presenti (riscaldamento, ACS, raffrescamento, ventilazione, FER)
5. Classe energetica stimata (da verificare con calcolo)
6. Note per il tecnico certificatore`,

    sanatoria: `Genera un'ISTANZA DI ACCERTAMENTO DI CONFORMITÀ (Sanatoria) ai sensi dell'art. 36 D.P.R. 380/2001 e, se applicabile, con le semplificazioni introdotte dal Salva Casa 2024 (D.L. 69/2024 conv. L. 105/2024).
La struttura deve essere:
1. Intestazione allo Sportello Unico Edilizia del Comune
2. Dati richiedente e tecnico incaricato
3. Dati immobile e riferimenti catastali
4. Descrizione degli abusi/difformità da sanare
5. Titolo abilitativo che si richiede in sanatoria
6. Dichiarazione di doppia conformità (o conformità semplificata Salva Casa se applicabile)
7. Documentazione allegata (lista)
8. Richiesta formale e firma`,
  };

  return `${baseContext}\n\n${docInstructions[docType] || docInstructions.rel_tecnica}`;
}

function buildUserPrompt(docType, form) {
  return `Genera il documento "${DOC_TYPES.find(d => d.id === docType)?.label}" con i seguenti dati:

PROFESSIONISTA:
- Nome: ${form.profNome} ${form.profCognome}
- Ordine/Collegio: ${form.profOrdine}
- N. iscrizione: ${form.profNumIscrizione}
- Codice Fiscale: ${form.profCF}

COMMITTENTE:
- Nome: ${form.commNome} ${form.commCognome}
- Codice Fiscale: ${form.commCF}

IMMOBILE:
- Indirizzo: ${form.via} n. ${form.civico}${form.interno ? ` int. ${form.interno}` : ""}, ${form.comune} (${form.provincia})
- Dati catastali: Foglio ${form.foglio}, Mappale ${form.mappale}${form.subalterno ? `, Sub. ${form.subalterno}` : ""}
- Zona urbanistica: ${form.zonaUrbanistica || "da specificare"}
- Piano: ${form.pianoEdi || "da specificare"}
- Superficie: ${form.superficieMq ? form.superficieMq + " mq" : "da specificare"}
- Anno di costruzione: ${form.annoCostruzione || "da verificare"}
- Vincoli presenti: ${form.vincoli.length > 0 ? form.vincoli.join(", ") : "nessuno dichiarato"}

INTERVENTO:
- Tipo: ${form.tipoIntervento || "da specificare"}
- Descrizione: ${form.descrizione || "da specificare"}
- Superficie interessata: ${form.superficieIntervento ? form.superficieIntervento + " mq" : "da specificare"}
- Importo lavori: ${form.importoLavori ? "€ " + form.importoLavori : "da specificare"}
- Data inizio prevista: ${form.dataInizioLavori || "da definire"}

NOTE AGGIUNTIVE: ${form.noteAggiuntive || "nessuna"}

Data odierna: ${new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}

Genera il documento completo, formattato e pronto da usare come bozza.`;
}

export default function Module2() {
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [generatedDoc, setGeneratedDoc] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState("select"); // select | form | result

  const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleVincolo = (v) => {
    if (v === "Nessun vincolo") {
      setForm(prev => ({ ...prev, vincoli: ["Nessun vincolo"] }));
      return;
    }
    setForm(prev => {
      const filtered = prev.vincoli.filter(x => x !== "Nessun vincolo");
      return {
        ...prev,
        vincoli: filtered.includes(v)
          ? filtered.filter(x => x !== v)
          : [...filtered, v]
      };
    });
  };

  const generateDocument = async () => {
    setLoading(true);
    setGeneratedDoc("");
    setStep("result");
    try {
      const res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: buildSystemPrompt(selectedDoc),
          messages: [{ role: "user", content: buildUserPrompt(selectedDoc, form) }]
        })
      });
      const data = await res.json();
      setGeneratedDoc(data.content?.[0]?.text || "Errore nella generazione del documento.");
    } catch {
      setGeneratedDoc("⚠️ Errore di connessione. Verifica la connessione e riprova.");
    }
    setLoading(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedDoc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
    padding: "8px 11px", color: "#d4dde8", fontSize: 13,
    fontFamily: "'Syne', sans-serif", outline: "none",
    transition: "border-color 0.2s",
  };

  const labelStyle = {
    fontSize: 10, color: "rgba(201,168,76,0.7)", textTransform: "uppercase",
    letterSpacing: 1.2, marginBottom: 5, display: "block", fontWeight: 600
  };

  const sectionTitleStyle = {
    fontSize: 11, color: "#C9A84C", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: 1.5, marginBottom: 14, marginTop: 4,
    paddingBottom: 8, borderBottom: "1px solid rgba(201,168,76,0.15)"
  };

  return (
    <>
      <style>{`
        @keyframes docFadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        input:focus, textarea:focus, select:focus { border-color: rgba(201,168,76,0.4) !important; outline: none; }
        textarea { resize: vertical; }
        .doc-card:hover { border-color: rgba(201,168,76,0.4) !important; background: rgba(201,168,76,0.07) !important; transform: translateY(-1px); }
      `}</style>

      <div style={{
        display: "flex", flexDirection: "column", height: "100%", overflow: "hidden",
        background: "linear-gradient(160deg, #070d14 0%, #0b1929 60%, #08141f 100%)",
        position: "relative"
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `radial-gradient(ellipse at 80% 10%, rgba(201,168,76,0.04) 0%, transparent 50%),
            linear-gradient(rgba(201,168,76,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(201,168,76,0.02) 1px, transparent 1px)`,
          backgroundSize: "100% 100%, 60px 60px, 60px 60px", pointerEvents: "none"
        }} />

        {/* Header */}
        <div style={{
          padding: "14px 24px", borderBottom: "1px solid rgba(201,168,76,0.1)",
          background: "rgba(7,13,20,0.7)", backdropFilter: "blur(20px)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "relative", zIndex: 5, flexShrink: 0
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#e8d5a3" }}>Compilazione Documenti</div>
            <div style={{ fontSize: 10, color: "rgba(201,168,76,0.6)", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 1 }}>
              Modulo 2 · Asseverazioni · Relazioni Tecniche · APE
            </div>
          </div>

          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {["Tipo documento", "Dati", "Bozza generata"].map((s, i) => {
              const stepIndex = step === "select" ? 0 : step === "form" ? 1 : 2;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 5,
                    opacity: i <= stepIndex ? 1 : 0.3
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: "50%",
                      background: i < stepIndex ? "#C9A84C" : i === stepIndex ? "rgba(201,168,76,0.3)" : "rgba(255,255,255,0.1)",
                      border: i === stepIndex ? "1px solid #C9A84C" : "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, color: i < stepIndex ? "#070d14" : "#C9A84C", fontWeight: 700
                    }}>{i < stepIndex ? "✓" : i + 1}</div>
                    <span style={{ fontSize: 10, color: i === stepIndex ? "#C9A84C" : "rgba(255,255,255,0.4)", fontWeight: i === stepIndex ? 600 : 400 }}>{s}</span>
                  </div>
                  {i < 2 && <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 10 }}>›</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", position: "relative", zIndex: 4 }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>

            {/* STEP 1: Select document type */}
            {step === "select" && (
              <div style={{ animation: "docFadeIn 0.3s ease-out" }}>
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#e8d5a3", marginBottom: 6 }}>Che documento vuoi generare?</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontFamily: "'Crimson Pro', serif" }}>
                    Seleziona il tipo di documento. Compilerai i dati nel passo successivo.
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {DOC_TYPES.map(doc => (
                    <button key={doc.id} className="doc-card"
                      onClick={() => { setSelectedDoc(doc.id); setStep("form"); }}
                      style={{
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12, padding: "20px 18px", cursor: "pointer",
                        textAlign: "left", transition: "all 0.2s"
                      }}>
                      <div style={{ fontSize: 28, marginBottom: 10 }}>{doc.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#e8d5a3", marginBottom: 4 }}>{doc.label}</div>
                      <div style={{ fontSize: 11, color: "rgba(201,168,76,0.5)", letterSpacing: 0.3 }}>{doc.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: Form */}
            {step === "form" && (
              <div style={{ animation: "docFadeIn 0.3s ease-out" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#e8d5a3" }}>
                      {DOC_TYPES.find(d => d.id === selectedDoc)?.icon} {DOC_TYPES.find(d => d.id === selectedDoc)?.label}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2, fontFamily: "'Crimson Pro', serif" }}>
                      Compila i dati disponibili. I campi vuoti saranno segnalati nel documento come da completare.
                    </div>
                  </div>
                  <button onClick={() => setStep("select")} style={{
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8, padding: "7px 14px", color: "rgba(255,255,255,0.5)",
                    cursor: "pointer", fontSize: 12
                  }}>← Cambia tipo</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

                  {/* Professionista */}
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "18px 20px" }}>
                    <div style={sectionTitleStyle}>👤 Dati Professionista</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {[["profNome", "Nome"], ["profCognome", "Cognome"]].map(([f, l]) => (
                        <div key={f}>
                          <label style={labelStyle}>{l}</label>
                          <input style={inputStyle} value={form[f]} onChange={e => updateForm(f, e.target.value)} placeholder={l} />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                      <div>
                        <label style={labelStyle}>Ordine / Collegio</label>
                        <select style={{ ...inputStyle, cursor: "pointer" }} value={form.profOrdine} onChange={e => updateForm("profOrdine", e.target.value)}>
                          <option value="">Seleziona...</option>
                          <option>Ordine degli Ingegneri</option>
                          <option>Ordine degli Architetti</option>
                          <option>Collegio dei Geometri</option>
                          <option>Ordine dei Periti Industriali</option>
                          <option>Ordine dei Geologi</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>N. Iscrizione</label>
                        <input style={inputStyle} value={form.profNumIscrizione} onChange={e => updateForm("profNumIscrizione", e.target.value)} placeholder="es. 1234" />
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <label style={labelStyle}>Codice Fiscale Professionista</label>
                      <input style={inputStyle} value={form.profCF} onChange={e => updateForm("profCF", e.target.value)} placeholder="XYZABC00A00A000A" />
                    </div>
                  </div>

                  {/* Committente */}
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "18px 20px" }}>
                    <div style={sectionTitleStyle}>🏢 Dati Committente</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {[["commNome", "Nome"], ["commCognome", "Cognome"]].map(([f, l]) => (
                        <div key={f}>
                          <label style={labelStyle}>{l}</label>
                          <input style={inputStyle} value={form[f]} onChange={e => updateForm(f, e.target.value)} placeholder={l} />
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <label style={labelStyle}>Codice Fiscale / P.IVA</label>
                      <input style={inputStyle} value={form.commCF} onChange={e => updateForm("commCF", e.target.value)} placeholder="Codice fiscale o Partita IVA" />
                    </div>
                  </div>

                  {/* Immobile */}
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "18px 20px" }}>
                    <div style={sectionTitleStyle}>🏠 Dati Immobile</div>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={labelStyle}>Via / Piazza</label>
                        <input style={inputStyle} value={form.via} onChange={e => updateForm("via", e.target.value)} placeholder="Via Roma" />
                      </div>
                      <div>
                        <label style={labelStyle}>Civico</label>
                        <input style={inputStyle} value={form.civico} onChange={e => updateForm("civico", e.target.value)} placeholder="12" />
                      </div>
                      <div>
                        <label style={labelStyle}>Interno</label>
                        <input style={inputStyle} value={form.interno} onChange={e => updateForm("interno", e.target.value)} placeholder="A" />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginTop: 10 }}>
                      <div>
                        <label style={labelStyle}>Comune</label>
                        <input style={inputStyle} value={form.comune} onChange={e => updateForm("comune", e.target.value)} placeholder="Milano" />
                      </div>
                      <div>
                        <label style={labelStyle}>Provincia</label>
                        <input style={inputStyle} value={form.provincia} onChange={e => updateForm("provincia", e.target.value)} placeholder="MI" />
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <label style={labelStyle}>Dati Catastali (Foglio / Mappale / Subalterno)</label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        {[["foglio", "Foglio"], ["mappale", "Mappale"], ["subalterno", "Sub."]].map(([f, l]) => (
                          <input key={f} style={inputStyle} value={form[f]} onChange={e => updateForm(f, e.target.value)} placeholder={l} />
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                      <div>
                        <label style={labelStyle}>Zona Urbanistica</label>
                        <select style={{ ...inputStyle, cursor: "pointer" }} value={form.zonaUrbanistica} onChange={e => updateForm("zonaUrbanistica", e.target.value)}>
                          <option value="">Seleziona...</option>
                          {["A - Centro Storico","B - Completamento","C - Espansione","D - Industriale","E - Agricola","F - Attrezzature"].map(z => <option key={z}>{z}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Superficie (mq)</label>
                        <input style={inputStyle} value={form.superficieMq} onChange={e => updateForm("superficieMq", e.target.value)} placeholder="80" type="number" />
                      </div>
                      <div>
                        <label style={labelStyle}>Anno costruzione</label>
                        <input style={inputStyle} value={form.annoCostruzione} onChange={e => updateForm("annoCostruzione", e.target.value)} placeholder="1975" type="number" />
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <label style={labelStyle}>Vincoli presenti</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                        {VINCOLI_OPTIONS.map(v => {
                          const active = form.vincoli.includes(v);
                          return (
                            <button key={v} onClick={() => toggleVincolo(v)} style={{
                              padding: "4px 10px", borderRadius: 20, border: "1px solid",
                              borderColor: active ? "#C9A84C" : "rgba(255,255,255,0.1)",
                              background: active ? "rgba(201,168,76,0.15)" : "transparent",
                              color: active ? "#C9A84C" : "rgba(255,255,255,0.4)",
                              fontSize: 10, cursor: "pointer", transition: "all 0.15s"
                            }}>{v}</button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Intervento */}
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "18px 20px" }}>
                    <div style={sectionTitleStyle}>🔨 Dati Intervento</div>
                    <div>
                      <label style={labelStyle}>Tipo di intervento</label>
                      <select style={{ ...inputStyle, cursor: "pointer" }} value={form.tipoIntervento} onChange={e => updateForm("tipoIntervento", e.target.value)}>
                        <option value="">Seleziona...</option>
                        {[
                          "Manutenzione ordinaria","Manutenzione straordinaria",
                          "Restauro e risanamento conservativo","Ristrutturazione edilizia",
                          "Nuova costruzione","Cambio destinazione d'uso",
                          "Ampliamento volumetrico","Intervento strutturale",
                          "Riqualificazione energetica","Frazionamento/fusione unità"
                        ].map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <label style={labelStyle}>Descrizione dettagliata dell'intervento</label>
                      <textarea
                        rows={5} style={{ ...inputStyle, lineHeight: 1.6, fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 13.5 }}
                        value={form.descrizione} onChange={e => updateForm("descrizione", e.target.value)}
                        placeholder="Descrivi le opere da realizzare con il massimo dettaglio possibile: tipologia, localizzazione nell'immobile, materiali, dimensioni..."
                      />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                      <div>
                        <label style={labelStyle}>Superficie interessata (mq)</label>
                        <input style={inputStyle} value={form.superficieIntervento} onChange={e => updateForm("superficieIntervento", e.target.value)} placeholder="45" type="number" />
                      </div>
                      <div>
                        <label style={labelStyle}>Importo lavori (€)</label>
                        <input style={inputStyle} value={form.importoLavori} onChange={e => updateForm("importoLavori", e.target.value)} placeholder="25000" type="number" />
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <label style={labelStyle}>Data inizio lavori prevista</label>
                      <input style={inputStyle} value={form.dataInizioLavori} onChange={e => updateForm("dataInizioLavori", e.target.value)} type="date" />
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <label style={labelStyle}>Note aggiuntive per il documento</label>
                      <textarea rows={2} style={{ ...inputStyle, fontFamily: "'Crimson Pro', serif", fontSize: 13 }}
                        value={form.noteAggiuntive} onChange={e => updateForm("noteAggiuntive", e.target.value)}
                        placeholder="Eventuali specificità dell'immobile, precedenti pratiche, comunicazioni al Comune..."
                      />
                    </div>
                  </div>
                </div>

                {/* Generate button */}
                <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
                  <button onClick={generateDocument} style={{
                    padding: "14px 40px",
                    background: "linear-gradient(135deg, #C9A84C, #8B6914)",
                    border: "none", borderRadius: 12, cursor: "pointer",
                    fontSize: 14, fontWeight: 700, color: "#070d14",
                    fontFamily: "'Syne', sans-serif", letterSpacing: 0.5,
                    boxShadow: "0 4px 20px rgba(201,168,76,0.35)", transition: "all 0.2s"
                  }}
                    onMouseEnter={e => e.target.style.boxShadow = "0 6px 28px rgba(201,168,76,0.5)"}
                    onMouseLeave={e => e.target.style.boxShadow = "0 4px 20px rgba(201,168,76,0.35)"}
                  >
                    📄 Genera Bozza Documento
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Result */}
            {step === "result" && (
              <div style={{ animation: "docFadeIn 0.3s ease-out" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#e8d5a3" }}>
                      ✅ Bozza generata: {DOC_TYPES.find(d => d.id === selectedDoc)?.label}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2, fontFamily: "'Crimson Pro', serif" }}>
                      Revisiona il documento, integra le parti mancanti, poi apponi firma e timbro.
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setStep("form")} style={{
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, padding: "8px 14px", color: "rgba(255,255,255,0.5)",
                      cursor: "pointer", fontSize: 12
                    }}>← Modifica dati</button>
                    <button onClick={copyToClipboard} disabled={loading} style={{
                      background: copied ? "rgba(34,197,94,0.2)" : "rgba(201,168,76,0.15)",
                      border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "rgba(201,168,76,0.3)"}`,
                      borderRadius: 8, padding: "8px 16px",
                      color: copied ? "#22c55e" : "#C9A84C",
                      cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.2s"
                    }}>{copied ? "✓ Copiato!" : "📋 Copia testo"}</button>
                  </div>
                </div>

                <div style={{
                  background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12, padding: "28px 32px", minHeight: 400,
                  fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 14, lineHeight: 1.85,
                  color: "#d4dde8", whiteSpace: "pre-wrap", letterSpacing: 0.15,
                  position: "relative"
                }}>
                  {loading ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 16 }}>
                      <div style={{
                        width: 200, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden"
                      }}>
                        <div style={{
                          height: "100%", background: "linear-gradient(90deg, transparent, #C9A84C, transparent)",
                          backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite",
                          borderRadius: 2
                        }} />
                      </div>
                      <div style={{ fontSize: 13, color: "rgba(201,168,76,0.6)" }}>Generazione documento in corso...</div>
                    </div>
                  ) : generatedDoc}
                </div>

                <div style={{
                  marginTop: 14, padding: "10px 16px",
                  background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.12)",
                  borderRadius: 8, fontSize: 11, color: "rgba(201,168,76,0.6)"
                }}>
                  ⚠️ <strong>Avviso professionale:</strong> Questo documento è una bozza generata automaticamente. Deve essere revisionato, integrato e validato dal professionista tecnico prima dell'utilizzo. I campi [DATO MANCANTE] devono essere compilati. La responsabilità della correttezza e della firma rimane esclusivamente in capo al tecnico abilitato.
                </div>

                <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 12 }}>
                  <button onClick={() => { setStep("select"); setGeneratedDoc(""); setForm(INITIAL_FORM); }} style={{
                    padding: "11px 24px", background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
                    color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13, fontFamily: "'Syne', sans-serif"
                  }}>+ Nuovo documento</button>
                  <button onClick={generateDocument} style={{
                    padding: "11px 24px", background: "rgba(201,168,76,0.12)",
                    border: "1px solid rgba(201,168,76,0.25)", borderRadius: 10,
                    color: "#C9A84C", cursor: "pointer", fontSize: 13, fontFamily: "'Syne', sans-serif", fontWeight: 600
                  }}>↻ Rigenera</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
