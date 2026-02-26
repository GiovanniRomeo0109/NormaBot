import { useState, useEffect } from "react";

const PROXY_URL = import.meta.env.VITE_PROXY_URL || "http://localhost:3001/api/claude";

// ─── DATI STATICI DI FALLBACK ────────────────────────────────────────────────
// Usati solo se normative-feed.json non è ancora stato generato dal crawler
const STATIC_FALLBACK = [
  { id:"s001", data:"2024-07-24", titolo:"Salva Casa — D.L. 69/2024 conv. L. 105/2024", fonte:"Gazzetta Ufficiale", categoria:"Titoli Abilitativi", tag:["CILA","SCIA","Sanatoria","Stato legittimo","Tolleranze"], sommario:"Riforma organica del TUE: nuove tolleranze costruttive (2-5% per fascia di superficie), semplificazione dello stato legittimo, sanatoria parziale disgiunta dalla compravendita, cambio d'uso semplificato nei capoluoghi.", urgenza:"alta", riferimento:"D.L. 69/2024 conv. L. 105/2024" },
  { id:"s002", data:"2024-12-01", titolo:"Nuovo Codice Appalti — Correttivo D.Lgs. 209/2024", fonte:"MIT", categoria:"Appalti Pubblici", tag:["Appalti","BIM","Collaudo"], sommario:"Correttivo al D.Lgs. 36/2023: modifiche alle soglie per affidamento diretto, chiarimenti su obblighi BIM, revisione delle disposizioni sul collaudo tecnico-amministrativo.", urgenza:"media", riferimento:"D.Lgs. 209/2024" },
  { id:"s003", data:"2024-11-15", titolo:"Aggiornamento NTC — Circolare applicativa sismica", fonte:"Consiglio Superiore LL.PP.", categoria:"Normativa Strutturale", tag:["Sismica","NTC 2018","Zona sismica"], sommario:"Nuove istruzioni applicative per la valutazione della sicurezza sismica degli edifici esistenti in muratura. Chiarimenti sul metodo LV1 per interventi di miglioramento.", urgenza:"media", riferimento:"Circolare CSLLPP n. 7/2024" },
  { id:"s004", data:"2024-10-30", titolo:"Superbonus — Proroga e modifiche aliquote 2025", fonte:"MEF / Agenzia Entrate", categoria:"Bonus Fiscali", tag:["Superbonus","Ecobonus","Sismabonus","Congruità spese"], sommario:"Conferma aliquota al 65% per il 2025 per condomini con CILAS presentata entro 31/12/2023. Nuove regole per l'attestazione della congruità delle spese. Stop cessione del credito confermato.", urgenza:"alta", riferimento:"L. 213/2023 + Circ. AE 13/E/2024" },
  { id:"s005", data:"2024-09-20", titolo:"Rendimento energetico edifici — Direttiva EPBD IV", fonte:"Ministero Ambiente", categoria:"Efficienza Energetica", tag:["APE","Classe energetica","NZEB"], sommario:"Avvio iter di recepimento della Direttiva 2024/1275/UE. Nuovi criteri per la classificazione energetica, obbligo di ristrutturazione per edifici in classe G entro 2030.", urgenza:"media", riferimento:"Direttiva UE 2024/1275" },
  { id:"s006", data:"2024-08-05", titolo:"Piano Casa Regione Lombardia — Aggiornamento LR 12/2005", fonte:"Regione Lombardia", categoria:"Normativa Regionale", tag:["Lombardia","Ampliamento","Piano Casa"], sommario:"Modifiche alla LR 12/2005: nuove disposizioni per gli ampliamenti del 20% in deroga, semplificazione per il recupero sottotetti.", urgenza:"bassa", riferimento:"LR Lombardia — modifica LR 12/2005" },
  { id:"s007", data:"2024-07-10", titolo:"Prevenzione incendi — D.M. 1 luglio 2024", fonte:"Ministero Interno", categoria:"Sicurezza", tag:["Prevenzione incendi","CPI","SCIA antincendio"], sommario:"Aggiornamento norme tecniche per edifici residenziali con più di 8 piani. Nuove procedure per la SCIA antincendio e modifiche ai requisiti per il CPI.", urgenza:"media", riferimento:"D.M. 1 luglio 2024 (GU n. 168/2024)" },
  { id:"s008", data:"2025-01-15", titolo:"AI Act — Obbligo alfabetizzazione AI per professionisti tecnici", fonte:"Unione Europea / CNI", categoria:"Normativa Professionale", tag:["AI Act","Formazione"], sommario:"Dal 2 febbraio 2025 è in vigore l'art. 4 dell'AI Act UE: i professionisti tecnici devono dimostrare un livello base di alfabetizzazione AI.", urgenza:"bassa", riferimento:"Reg. UE 2024/1689 — Art. 4" },
];

const CAT_COLORS = {
  "Titoli Abilitativi":"#C9A84C","Appalti Pubblici":"#6b9fd4",
  "Normativa Strutturale":"#e07b54","Bonus Fiscali":"#22c55e",
  "Efficienza Energetica":"#34d399","Normativa Regionale":"#a78bfa",
  "Sicurezza":"#f87171","Normativa Professionale":"#94a3b8",
  "Catasto e Fiscalità Immobiliare":"#f59e0b","Normativa Generale":"#64748b",
};
const URG = {
  alta:  { label:"Urgente", color:"#f87171", bg:"rgba(248,113,113,0.1)" },
  media: { label:"Media",   color:"#C9A84C", bg:"rgba(201,168,76,0.1)"  },
  bassa: { label:"Info",    color:"#94a3b8", bg:"rgba(148,163,184,0.1)" },
};
const TIPO_OPTIONS = ["CILA","SCIA","SCIA alternativa PdC","Permesso di Costruire","Sanatoria","Agibilità","Autorizzazione sismica","APE","Pratica appalto pubblico","Altro"];
const STORAGE_KEY    = "normabot_pratiche_v1";
const CRAWL_DATE_KEY = "normabot_last_crawl";
const EMPTY = { id:null, nome:"", tipo:"", comune:"", cliente:"", dataApertura:"", scadenza:"", note:"", tag:[] };

const loadPratiche  = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); } catch { return []; } };
const loadLastCrawl = () => { try { return localStorage.getItem(CRAWL_DATE_KEY) || null; } catch { return null; } };
const saveLastCrawl = (iso) => { try { localStorage.setItem(CRAWL_DATE_KEY, iso); } catch {} };

const buildPrompt = (pratiche, norme) => `Sei un consulente esperto di normativa edilizia italiana. Analizza le seguenti pratiche attive e indica quali aggiornamenti normativi le impattano e come.

PRATICHE ATTIVE:
${pratiche.length===0 ? "Nessuna pratica — fornisci analisi generale delle norme più rilevanti per uno studio tecnico." : pratiche.map((p,i)=>`${i+1}. "${p.nome}" | Tipo: ${p.tipo||"n/d"} | Comune: ${p.comune||"n/d"} | Cliente: ${p.cliente||"n/d"} | Scadenza: ${p.scadenza||"n/d"} | Tag: ${p.tag.join(", ")||"nessuno"} | Note: ${p.note||"nessuna"}`).join("\n")}

AGGIORNAMENTI NORMATIVI RECENTI:
${norme.map((n,i)=>`${i+1}. [${n.data}] ${n.titolo} (${n.riferimento}) — Tag: ${n.tag?.join(", ")||""} — ${n.sommario}`).join("\n")}

Per ogni pratica impattata:
📁 PRATICA: [nome]
⚖️ NORMA: [titolo norma]
📋 IMPATTO: [descrizione concreta]
✅ AZIONE: [cosa fare e urgenza]

Inizia con sommario 2-3 righe. Concludi con pratiche non impattate. Rispondi in italiano, tono professionale.`;

export default function Module3() {
  const [pratiche, setPratiche]     = useState(loadPratiche);
  const [feed, setFeed]             = useState([]);
  const [feedMeta, setFeedMeta]     = useState(null); // { lastUpdated, source, isCrawled }
  const [feedLoading, setFeedLoading] = useState(true);
  const [tab, setTab]               = useState("feed");
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(EMPTY);
  const [tagInput, setTagInput]     = useState("");
  const [filterCat, setFilterCat]   = useState("Tutte");
  const [filterUrg, setFilterUrg]   = useState("Tutte");
  const [analisi, setAnalisi]       = useState("");
  const [loading, setLoading]       = useState(false);
  const [crawlerLoading, setCrawlerLoading] = useState(false);
  const [crawlerStatus, setCrawlerStatus]   = useState(null);
  const [lastCrawlDate, setLastCrawlDate]   = useState(loadLastCrawl);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(pratiche)); }, [pratiche]);

  // ── Carica feed dal file generato dal crawler (o fallback statico) ──────────
  useEffect(() => {
    const loadFeed = async () => {
      setFeedLoading(true);
      try {
        const res = await fetch("/normative-feed.json");
        if (!res.ok) throw new Error("File non trovato");
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          setFeed(data.items);
          setFeedMeta({ lastUpdated: data.lastUpdated, source: data.source, isCrawled: true });
        } else {
          throw new Error("Feed vuoto");
        }
      } catch {
        // Fallback ai dati statici
        setFeed(STATIC_FALLBACK);
        setFeedMeta({ lastUpdated: null, source: "Dati statici (crawler non ancora eseguito)", isCrawled: false });
      }
      setFeedLoading(false);
    };
    loadFeed();
  }, []);

  const savePratica = () => {
    if (!editing.nome.trim()) return;
    editing.id
      ? setPratiche(p => p.map(x => x.id===editing.id ? editing : x))
      : setPratiche(p => [...p, {...editing, id:Date.now().toString()}]);
    setEditing(EMPTY); setShowForm(false); setTagInput("");
  };
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !editing.tag.includes(t)) setEditing(p=>({...p,tag:[...p.tag,t]}));
    setTagInput("");
  };

  const runCrawler = async () => {
    setCrawlerLoading(true);
    setCrawlerStatus(null);
    try {
      // Health check: verifica che il proxy sia attivo
      const health = await fetch("http://localhost:3001/health").catch(() => null);
      if (!health || !health.ok) throw new Error("Proxy non raggiungibile — assicurati che server.js sia avviato (npm run server)");

      const today = new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"long",year:"numeric"});
      const res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model:      "claude-sonnet-4-20250514",
          max_tokens: 4000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          system: "Sei un esperto di normativa edilizia italiana. Dopo aver effettuato le ricerche, restituisci SOLO un JSON array valido, senza testo aggiuntivo, senza markdown, senza backtick.",
          messages: [{
            role: "user",
            content: `Data odierna: ${today}.

Cerca in internet gli aggiornamenti normativi italiani più recenti (ultimi 6 mesi) in materia di:
- Titoli abilitativi edilizi (CILA, SCIA, Permesso di Costruire)
- Bonus fiscali (Superbonus, Ecobonus, Sismabonus, Bonus Barriere)
- Efficienza energetica e APE
- Normativa strutturale e sismica
- Codice Appalti
- Normativa professionale per tecnici

Fonti prioritarie: Gazzetta Ufficiale, MIT, MEF, Agenzia Entrate, CSLLPP, portali regionali.

Dopo la ricerca, restituisci SOLO questo JSON array (nessun testo prima o dopo):
[{
  "id":"w001",
  "data":"YYYY-MM-DD",
  "titolo":"titolo della norma o aggiornamento",
  "fonte":"es. Gazzetta Ufficiale n.XX / MIT / MEF / Regione X",
  "categoria":"una tra: Titoli Abilitativi | Appalti Pubblici | Normativa Strutturale | Bonus Fiscali | Efficienza Energetica | Normativa Regionale | Sicurezza | Normativa Professionale | Normativa Generale",
  "tag":["tag1","tag2","tag3"],
  "sommario":"2-3 frasi precise su cosa cambia per il professionista tecnico",
  "urgenza":"alta | media | bassa",
  "riferimento":"riferimento normativo preciso es. D.L. 69/2024 conv. L. 105/2024"
}]

Includi almeno 6 aggiornamenti reali trovati in rete. Solo JSON.`
          }]
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        throw new Error(err?.error?.message || `Errore API ${res.status}`);
      }

      const d = await res.json();
      // Raccoglie tutti i blocchi testo (web_search può restituire più blocchi)
      const raw = (d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").trim();
      const cleaned = raw.replace(/```json|```/gm,"").trim();
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("Il modello non ha restituito un JSON valido");
      const items = JSON.parse(match[0]);
      if (!Array.isArray(items)||items.length===0) throw new Error("Nessun aggiornamento trovato");
      const nowIso = new Date().toISOString();
      setFeed(items);
      setFeedMeta({ lastUpdated:nowIso, source:"Web Search", isCrawled:true, count:items.length });
      setLastCrawlDate(nowIso);
      saveLastCrawl(nowIso);
      setCrawlerStatus(null);
    } catch(err) {
      setCrawlerStatus(`⚠️ ${err.message}`);
    }
    setCrawlerLoading(false);
  };

  const runAnalysis = async () => {
    setLoading(true); setAnalisi(""); setTab("analisi");
    try {
      const res = await fetch(PROXY_URL, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{role:"user",content:buildPrompt(pratiche,filteredFeed)}] })
      });
      const d = await res.json();
      setAnalisi(d.content?.[0]?.text || "Errore.");
    } catch { setAnalisi("⚠️ Errore di connessione."); }
    setLoading(false);
  };

  const filteredFeed = feed
    .filter(n => filterCat==="Tutte" || n.categoria===filterCat)
    .filter(n => filterUrg==="Tutte"  || n.urgenza===filterUrg)
    .sort((a,b) => new Date(b.data)-new Date(a.data));

  const categorie = ["Tutte", ...new Set(feed.map(n=>n.categoria))];

  const inp = {width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 11px",color:"#d4dde8",fontSize:13,fontFamily:"'Syne',sans-serif",outline:"none"};
  const lbl = {fontSize:10,color:"rgba(201,168,76,0.7)",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,display:"block",fontWeight:600};
  const tabBtn = (id, label) => (
    <button key={id} onClick={()=>setTab(id)} style={{padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:tab===id?700:400,fontFamily:"'Syne',sans-serif",background:tab===id?"rgba(201,168,76,0.15)":"transparent",color:tab===id?"#C9A84C":"rgba(255,255,255,0.4)",borderBottom:tab===id?"2px solid #C9A84C":"2px solid transparent",transition:"all 0.2s"}}>{label}</button>
  );

  return (
    <>
      <style>{`
        @keyframes m3in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        input:focus,textarea:focus,select:focus{border-color:rgba(201,168,76,0.4)!important;outline:none}
        textarea{resize:vertical}
        .nc:hover{border-color:rgba(255,255,255,0.16)!important}
        .pr:hover{background:rgba(255,255,255,0.04)!important}
      `}</style>

      <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",background:"linear-gradient(160deg,#070d14 0%,#0b1929 60%,#08141f 100%)",position:"relative"}}>
        <div style={{position:"absolute",inset:0,pointerEvents:"none",backgroundImage:`radial-gradient(ellipse at 70% 0%,rgba(201,168,76,0.04) 0%,transparent 50%),linear-gradient(rgba(201,168,76,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,0.02) 1px,transparent 1px)`,backgroundSize:"100% 100%,60px 60px,60px 60px"}}/>

        {/* HEADER */}
        <div style={{padding:"14px 24px",borderBottom:"1px solid rgba(201,168,76,0.1)",background:"rgba(7,13,20,0.7)",backdropFilter:"blur(20px)",display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative",zIndex:5,flexShrink:0}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:"#e8d5a3"}}>Monitor Normativo</div>
            <div style={{fontSize:10,color:"rgba(201,168,76,0.6)",letterSpacing:1.5,textTransform:"uppercase",marginTop:1}}>Modulo 3 · Feed · Pratiche · Alert AI</div>
          </div>
          <div style={{display:"flex",gap:4}}>
            {tabBtn("feed",     `📰 Feed (${filteredFeed.length})`)}
            {tabBtn("pratiche", `📁 Pratiche (${pratiche.length})`)}
            {tabBtn("analisi",  "🤖 Analisi AI")}
          </div>
          <button onClick={runAnalysis} style={{padding:"8px 18px",background:"linear-gradient(135deg,#C9A84C,#8B6914)",border:"none",borderRadius:9,cursor:"pointer",fontSize:12,fontWeight:700,color:"#070d14",fontFamily:"'Syne',sans-serif",boxShadow:"0 2px 12px rgba(201,168,76,0.3)"}}>
            ⚡ Analizza impatti
          </button>
        </div>

        {/* FEED STATUS BAR */}
        <div style={{padding:"7px 24px",borderBottom:"1px solid rgba(255,255,255,0.05)",background:"rgba(255,255,255,0.02)",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          {/* Pallino stato */}
          <div style={{width:6,height:6,borderRadius:"50%",flexShrink:0,
            background: crawlerLoading ? "#C9A84C" : crawlerStatus?.startsWith("⚠️") ? "#f87171" : lastCrawlDate ? "#22c55e" : "#C9A84C",
            animation: crawlerLoading ? "pulse 0.8s ease-in-out infinite" : "none"
          }}/>

          {/* Testo di stato */}
          <span style={{fontSize:10,flex:1,
            color: crawlerStatus?.startsWith("⚠️") ? "#f87171" : "rgba(255,255,255,0.35)"
          }}>
            {crawlerLoading
              ? "🔍 Ricerca aggiornamenti normativi in tempo reale — operazione fino a 30 secondi..."
              : crawlerStatus?.startsWith("⚠️")
                ? crawlerStatus
                : lastCrawlDate
                  ? `Ultimo aggiornamento: ${new Date(lastCrawlDate).toLocaleString("it-IT",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})} · ${feed.length} norme nel feed`
                  : `Mai aggiornato · ${feed.length} norme precaricate`}
          </span>

          {/* Pulsante crawler */}
          <button
            onClick={runCrawler}
            disabled={crawlerLoading}
            style={{
              display:"flex", alignItems:"center", gap:6,
              padding:"5px 14px",
              background: crawlerLoading
                ? "rgba(201,168,76,0.06)"
                : "linear-gradient(135deg,rgba(201,168,76,0.22),rgba(201,168,76,0.08))",
              border:"1px solid rgba(201,168,76,0.3)",
              borderRadius:20, cursor:crawlerLoading?"not-allowed":"pointer",
              fontSize:11, fontWeight:600,
              color:crawlerLoading?"rgba(201,168,76,0.35)":"#C9A84C",
              fontFamily:"'Syne',sans-serif", transition:"all 0.2s",
            }}
          >
            <span style={{
              display:"inline-block",
              animation:crawlerLoading?"spin 0.8s linear infinite":"none",
              fontSize:13, lineHeight:1
            }}>
              {crawlerLoading ? "⟳" : "🌐"}
            </span>
            {crawlerLoading ? "Aggiornamento in corso..." : "Aggiorna con AI"}
          </button>
        </div>

        {/* CONTENT */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 24px",position:"relative",zIndex:4}}>
          <div style={{maxWidth:960,margin:"0 auto"}}>

            {/* ── FEED ── */}
            {tab==="feed" && (
              <div style={{animation:"m3in 0.3s ease-out"}}>

                {feedLoading ? (
                  <div style={{textAlign:"center",padding:"60px 20px"}}>
                    <div style={{width:220,height:4,background:"rgba(255,255,255,0.07)",borderRadius:2,overflow:"hidden",margin:"0 auto 16px"}}>
                      <div style={{height:"100%",background:"linear-gradient(90deg,transparent,#C9A84C,transparent)",backgroundSize:"200% 100%",animation:"shimmer 1.5s infinite",borderRadius:2}}/>
                    </div>
                    <div style={{fontSize:13,color:"rgba(201,168,76,0.6)",fontFamily:"'Crimson Pro',serif"}}>Caricamento feed normativo...</div>
                  </div>
                ) : (
                  <>
                    {/* Filtri */}
                    <div style={{display:"flex",gap:7,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{fontSize:11,color:"rgba(255,255,255,0.25)"}}>Categoria:</span>
                      {categorie.map(c=>{
                        const col=CAT_COLORS[c]||"#C9A84C"; const act=filterCat===c;
                        return <button key={c} onClick={()=>setFilterCat(c)} style={{padding:"3px 11px",borderRadius:20,border:`1px solid ${act?col:"rgba(255,255,255,0.1)"}`,background:act?`${col}20`:"transparent",color:act?col:"rgba(255,255,255,0.4)",fontSize:10,cursor:"pointer",transition:"all 0.15s"}}>{c}</button>;
                      })}
                      <span style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
                        <span style={{fontSize:11,color:"rgba(255,255,255,0.25)"}}>Urgenza:</span>
                        {["Tutte","alta","media","bassa"].map(u=>{
                          const cfg=URG[u]||{color:"#C9A84C",bg:"transparent"}; const act=filterUrg===u;
                          return <button key={u} onClick={()=>setFilterUrg(u)} style={{padding:"3px 11px",borderRadius:20,border:`1px solid ${act?cfg.color:"rgba(255,255,255,0.1)"}`,background:act?cfg.bg:"transparent",color:act?cfg.color:"rgba(255,255,255,0.4)",fontSize:10,cursor:"pointer",transition:"all 0.15s"}}>{u==="Tutte"?"Tutte":cfg.label}</button>;
                        })}
                      </span>
                    </div>

                    {/* Cards */}
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {filteredFeed.length===0 ? (
                        <div style={{textAlign:"center",padding:"40px",color:"rgba(255,255,255,0.2)",fontFamily:"'Crimson Pro',serif"}}>
                          <div style={{fontSize:30,marginBottom:10}}>🔍</div>
                          <div>Nessun risultato per i filtri selezionati</div>
                        </div>
                      ) : filteredFeed.map(n=>{
                        const col=CAT_COLORS[n.categoria]||"#94a3b8";
                        const urg=URG[n.urgenza]||URG.bassa;
                        return (
                          <div key={n.id} className="nc" style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)",borderLeft:`3px solid ${col}`,borderRadius:10,padding:"16px 18px",transition:"border-color 0.2s"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                              <div style={{flex:1}}>
                                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6,flexWrap:"wrap"}}>
                                  <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:col,background:`${col}18`,border:`1px solid ${col}40`,borderRadius:20,padding:"2px 8px"}}>{n.categoria}</span>
                                  <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:urg.color,background:urg.bg,border:`1px solid ${urg.color}40`,borderRadius:20,padding:"2px 8px"}}>{urg.label}</span>
                                  <span style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>{n.fonte}</span>
                                  {n._crawledAt && <span style={{fontSize:9,color:"rgba(34,197,94,0.5)",padding:"1px 6px",borderRadius:20,border:"1px solid rgba(34,197,94,0.2)",background:"rgba(34,197,94,0.05)"}}>🔄 crawled</span>}
                                </div>
                                <div style={{fontSize:14,fontWeight:700,color:"#e8d5a3",marginBottom:6,lineHeight:1.3}}>{n.titolo}</div>
                                <div style={{fontSize:13,color:"rgba(212,221,232,0.65)",lineHeight:1.65,fontFamily:"'Crimson Pro',serif"}}>{n.sommario}</div>
                                {n.tag?.length>0 && (
                                  <div style={{marginTop:9,display:"flex",gap:5,flexWrap:"wrap"}}>
                                    {n.tag.map(t=><span key={t} style={{fontSize:9,padding:"2px 8px",borderRadius:20,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.38)"}}>{t}</span>)}
                                  </div>
                                )}
                              </div>
                              <div style={{textAlign:"right",flexShrink:0}}>
                                <div style={{fontSize:11,color:"#C9A84C",fontWeight:600,whiteSpace:"nowrap"}}>{new Date(n.data).toLocaleDateString("it-IT",{day:"2-digit",month:"short",year:"numeric"})}</div>
                                <div style={{fontSize:9,color:"rgba(255,255,255,0.22)",marginTop:3,maxWidth:160}}>{n.riferimento}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── PRATICHE ── */}
            {tab==="pratiche" && (
              <div style={{animation:"m3in 0.3s ease-out"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                  <div>
                    <div style={{fontSize:17,fontWeight:800,color:"#e8d5a3"}}>Registro Pratiche Attive</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.3)",fontFamily:"'Crimson Pro',serif",marginTop:2}}>
                      {pratiche.length===0?"Nessuna pratica. Aggiungine una per ricevere alert mirati.":`${pratiche.length} pratica${pratiche.length>1?"e":""} — salvate localmente`}
                    </div>
                  </div>
                  <button onClick={()=>{setEditing(EMPTY);setShowForm(true);}} style={{padding:"9px 18px",background:"linear-gradient(135deg,#C9A84C,#8B6914)",border:"none",borderRadius:9,cursor:"pointer",fontSize:12,fontWeight:700,color:"#070d14",fontFamily:"'Syne',sans-serif"}}>+ Nuova pratica</button>
                </div>

                {showForm && (
                  <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:12,padding:"20px 22px",marginBottom:20,animation:"m3in 0.25s ease-out"}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#C9A84C",marginBottom:16}}>{editing.id?"✏️ Modifica":"➕ Nuova pratica"}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                      <div style={{gridColumn:"1/3"}}>
                        <label style={lbl}>Nome / Riferimento *</label>
                        <input style={inp} value={editing.nome} onChange={e=>setEditing(p=>({...p,nome:e.target.value}))} placeholder="es. Ristrutturazione Via Roma 12 — Rossi"/>
                      </div>
                      <div>
                        <label style={lbl}>Tipo pratica</label>
                        <select style={{...inp,cursor:"pointer"}} value={editing.tipo} onChange={e=>setEditing(p=>({...p,tipo:e.target.value}))}>
                          <option value="">Seleziona...</option>
                          {TIPO_OPTIONS.map(t=><option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div><label style={lbl}>Comune</label><input style={inp} value={editing.comune} onChange={e=>setEditing(p=>({...p,comune:e.target.value}))} placeholder="Milano"/></div>
                      <div><label style={lbl}>Cliente</label><input style={inp} value={editing.cliente} onChange={e=>setEditing(p=>({...p,cliente:e.target.value}))} placeholder="Nome cliente"/></div>
                      <div><label style={lbl}>Data apertura</label><input style={inp} type="date" value={editing.dataApertura} onChange={e=>setEditing(p=>({...p,dataApertura:e.target.value}))}/></div>
                      <div><label style={lbl}>Scadenza</label><input style={inp} type="date" value={editing.scadenza} onChange={e=>setEditing(p=>({...p,scadenza:e.target.value}))}/></div>
                    </div>
                    <div style={{marginTop:12}}>
                      <label style={lbl}>Note / caratteristiche rilevanti</label>
                      <textarea rows={2} style={{...inp,fontFamily:"'Crimson Pro',serif",fontSize:13}} value={editing.note} onChange={e=>setEditing(p=>({...p,note:e.target.value}))} placeholder="es. Zona sismica 2, vincolo paesaggistico, Superbonus..."/>
                    </div>
                    <div style={{marginTop:12}}>
                      <label style={lbl}>Tag per matching AI</label>
                      <div style={{display:"flex",gap:8,marginBottom:8}}>
                        <input style={{...inp,flex:1}} value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(e.preventDefault(),addTag())} placeholder="es. Superbonus, Sismica... (Invio per aggiungere)"/>
                        <button onClick={addTag} style={{padding:"8px 14px",background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:8,color:"#C9A84C",cursor:"pointer",fontSize:12,flexShrink:0}}>+ Tag</button>
                      </div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {editing.tag.map(t=><span key={t} onClick={()=>setEditing(p=>({...p,tag:p.tag.filter(x=>x!==t)}))} style={{padding:"3px 10px",borderRadius:20,background:"rgba(201,168,76,0.12)",border:"1px solid rgba(201,168,76,0.3)",color:"#C9A84C",fontSize:10,cursor:"pointer"}}>{t} ×</span>)}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
                      <button onClick={()=>{setShowForm(false);setEditing(EMPTY);}} style={{padding:"8px 16px",background:"transparent",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:12}}>Annulla</button>
                      <button onClick={savePratica} disabled={!editing.nome.trim()} style={{padding:"8px 20px",background:editing.nome.trim()?"linear-gradient(135deg,#C9A84C,#8B6914)":"rgba(201,168,76,0.15)",border:"none",borderRadius:8,cursor:editing.nome.trim()?"pointer":"not-allowed",color:editing.nome.trim()?"#070d14":"rgba(201,168,76,0.4)",fontSize:12,fontWeight:700,fontFamily:"'Syne',sans-serif"}}>💾 Salva</button>
                    </div>
                  </div>
                )}

                {pratiche.length===0&&!showForm ? (
                  <div style={{textAlign:"center",padding:"60px 20px",color:"rgba(255,255,255,0.2)",fontFamily:"'Crimson Pro',serif"}}>
                    <div style={{fontSize:40,marginBottom:12}}>📁</div>
                    <div style={{fontSize:15}}>Nessuna pratica attiva</div>
                    <div style={{fontSize:12,marginTop:6}}>Aggiungi le tue pratiche per ricevere alert normativi mirati</div>
                  </div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {pratiche.map(p=>{
                      const scad=p.scadenza&&new Date(p.scadenza)<new Date();
                      const immin=p.scadenza&&!scad&&(new Date(p.scadenza)-new Date())<7*24*3600*1000;
                      return (
                        <div key={p.id} className="pr" style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${scad?"rgba(248,113,113,0.3)":immin?"rgba(201,168,76,0.3)":"rgba(255,255,255,0.07)"}`,borderRadius:10,padding:"14px 18px",display:"flex",alignItems:"flex-start",gap:14,transition:"background 0.15s"}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                              <span style={{fontSize:14,fontWeight:700,color:"#e8d5a3"}}>{p.nome}</span>
                              {p.tipo&&<span style={{fontSize:9,padding:"2px 8px",borderRadius:20,background:"rgba(201,168,76,0.12)",border:"1px solid rgba(201,168,76,0.25)",color:"#C9A84C",fontWeight:600,textTransform:"uppercase"}}>{p.tipo}</span>}
                              {scad&&<span style={{fontSize:9,padding:"2px 8px",borderRadius:20,background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",color:"#f87171",fontWeight:700}}>SCADUTA</span>}
                              {immin&&<span style={{fontSize:9,padding:"2px 8px",borderRadius:20,background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.3)",color:"#C9A84C",fontWeight:700}}>⚠ SCADENZA VICINA</span>}
                            </div>
                            <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",display:"flex",gap:16,flexWrap:"wrap"}}>
                              {p.comune&&<span>📍 {p.comune}</span>}
                              {p.cliente&&<span>👤 {p.cliente}</span>}
                              {p.dataApertura&&<span>📅 {new Date(p.dataApertura).toLocaleDateString("it-IT")}</span>}
                              {p.scadenza&&<span style={{color:scad?"#f87171":immin?"#C9A84C":"rgba(255,255,255,0.35)"}}>⏱ {new Date(p.scadenza).toLocaleDateString("it-IT")}</span>}
                            </div>
                            {p.tag.length>0&&<div style={{marginTop:7,display:"flex",gap:5,flexWrap:"wrap"}}>{p.tag.map(t=><span key={t} style={{fontSize:9,padding:"2px 8px",borderRadius:20,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",color:"rgba(255,255,255,0.35)"}}>{t}</span>)}</div>}
                          </div>
                          <div style={{display:"flex",gap:6,flexShrink:0}}>
                            <button onClick={()=>{setEditing(p);setShowForm(true);setTagInput("");}} style={{padding:"5px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:11}}>✏️</button>
                            <button onClick={()=>setPratiche(prev=>prev.filter(x=>x.id!==p.id))} style={{padding:"5px 12px",background:"rgba(248,113,113,0.07)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:7,color:"#f87171",cursor:"pointer",fontSize:11}}>🗑</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── ANALISI AI ── */}
            {tab==="analisi" && (
              <div style={{animation:"m3in 0.3s ease-out"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                  <div>
                    <div style={{fontSize:17,fontWeight:800,color:"#e8d5a3"}}>🤖 Analisi di Impatto AI</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.3)",fontFamily:"'Crimson Pro',serif",marginTop:2}}>Cross-referencing tra pratiche attive e {feed.length} aggiornamenti normativi</div>
                  </div>
                  <button onClick={runAnalysis} disabled={loading} style={{padding:"8px 18px",background:loading?"rgba(201,168,76,0.15)":"linear-gradient(135deg,#C9A84C,#8B6914)",border:"none",borderRadius:9,cursor:loading?"not-allowed":"pointer",fontSize:12,fontWeight:700,color:loading?"#C9A84C":"#070d14",fontFamily:"'Syne',sans-serif"}}>
                    {loading?"⏳ Analisi...":"↻ Rigenera"}
                  </button>
                </div>

                {loading&&(
                  <div style={{textAlign:"center",padding:"60px 20px"}}>
                    <div style={{width:220,height:4,background:"rgba(255,255,255,0.07)",borderRadius:2,overflow:"hidden",margin:"0 auto 16px"}}>
                      <div style={{height:"100%",background:"linear-gradient(90deg,transparent,#C9A84C,transparent)",backgroundSize:"200% 100%",animation:"shimmer 1.5s infinite",borderRadius:2}}/>
                    </div>
                    <div style={{fontSize:13,color:"rgba(201,168,76,0.6)",fontFamily:"'Crimson Pro',serif"}}>Analisi in corso...</div>
                  </div>
                )}

                {!loading&&!analisi&&(
                  <div style={{textAlign:"center",padding:"60px 20px",color:"rgba(255,255,255,0.2)",fontFamily:"'Crimson Pro',serif"}}>
                    <div style={{fontSize:40,marginBottom:12}}>⚡</div>
                    <div style={{fontSize:15}}>Premi "Analizza impatti" per avviare l'analisi</div>
                    <div style={{fontSize:12,marginTop:6}}>{pratiche.length===0?"Aggiungi prima le tue pratiche per un'analisi mirata":`Analizzerà ${pratiche.length} pratica${pratiche.length>1?"e":""} vs ${feed.length} aggiornamenti normativi`}</div>
                  </div>
                )}

                {!loading&&analisi&&(
                  <>
                    <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"26px 30px",fontFamily:"'Crimson Pro',Georgia,serif",fontSize:14,lineHeight:1.85,color:"#d4dde8",whiteSpace:"pre-wrap",letterSpacing:0.15}}>
                      {analisi}
                    </div>
                    <div style={{marginTop:12,padding:"10px 16px",background:"rgba(201,168,76,0.05)",border:"1px solid rgba(201,168,76,0.12)",borderRadius:8,fontSize:11,color:"rgba(201,168,76,0.55)"}}>
                      ⚠️ Analisi orientativa. Verifica sempre con la normativa originale prima di agire.
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </>
  );
}
