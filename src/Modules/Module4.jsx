import { useState, useRef } from "react";

const PROXY_URL = import.meta.env.VITE_PROXY_URL || "http://localhost:3001/api/claude";

const PREZZARIO = {
  "cappotto_eps":       { desc:"Cappotto termico EPS 10cm, posa inclusa",          um:"mq",  min:70,   max:120,  cat:"Isolamento" },
  "cappotto_eps_14":    { desc:"Cappotto termico EPS 14cm, posa inclusa",          um:"mq",  min:85,   max:140,  cat:"Isolamento" },
  "cappotto_mineral":   { desc:"Cappotto termico lana minerale 12cm",              um:"mq",  min:95,   max:155,  cat:"Isolamento" },
  "infissi_pvc":        { desc:"Infisso PVC doppio vetro basso emissivo",          um:"mq",  min:280,  max:480,  cat:"Infissi" },
  "infissi_legno_al":   { desc:"Infisso legno-alluminio triplo vetro",             um:"mq",  min:420,  max:700,  cat:"Infissi" },
  "infissi_alluminio":  { desc:"Infisso alluminio taglio termico",                 um:"mq",  min:350,  max:580,  cat:"Infissi" },
  "pompa_calore_aria":  { desc:"Pompa di calore aria-aria, fornitura e posa",      um:"kW",  min:600,  max:950,  cat:"Impianti" },
  "pompa_calore_acqua": { desc:"Pompa di calore aria-acqua con idromodulo",        um:"kW",  min:750,  max:1200, cat:"Impianti" },
  "caldaia_cond":       { desc:"Caldaia a condensazione classe A+",                um:"kW",  min:55,   max:95,   cat:"Impianti" },
  "pannelli_solari":    { desc:"Collettori solari termici, fornitura e posa",      um:"mq",  min:650,  max:900,  cat:"Impianti" },
  "fotovoltaico":       { desc:"Impianto fotovoltaico residenziale chiavi in mano",um:"kWp", min:1400, max:2200, cat:"Fotovoltaico" },
  "accumulo":           { desc:"Sistema di accumulo (batteria)",                   um:"kWh", min:600,  max:1000, cat:"Fotovoltaico" },
  "rinforzo_strutturale":{ desc:"Rinforzo strutturale con FRP (fibra carbonio)",   um:"mq",  min:90,   max:180,  cat:"Strutturale" },
  "consolidamento_fond":{ desc:"Consolidamento fondazioni, iniezioni di miscela",  um:"ml",  min:120,  max:220,  cat:"Strutturale" },
  "isolamento_sismico": { desc:"Isolatori sismici alla base, fornitura e posa",    um:"cad", min:3500, max:6000, cat:"Strutturale" },
  "pareti_tagliafuoco": { desc:"Pareti in c.a. per irrigidimento piano",           um:"mq",  min:280,  max:420,  cat:"Strutturale" },
  "ascensore_idraulico":{ desc:"Ascensore idraulico 2 fermate, fornitura e posa",  um:"cad", min:18000,max:28000,cat:"Accessibilità" },
  "servoscala":         { desc:"Servoscala a poltrona, fornitura e posa",          um:"cad", min:3500, max:6500, cat:"Accessibilità" },
  "rampa_accesso":      { desc:"Rampa accesso disabili in c.a. o acciaio",         um:"ml",  min:350,  max:650,  cat:"Accessibilità" },
  "bagno_accessibile":  { desc:"Adeguamento bagno accessibile, opere complete",    um:"cad", min:2800, max:5500, cat:"Accessibilità" },
  "tetto_coibentato":   { desc:"Rifacimento tetto con isolamento in copertura",    um:"mq",  min:110,  max:190,  cat:"Copertura" },
  "manto_coprente":     { desc:"Solo manto coprente (tegole/coppi), posa inclusa", um:"mq",  min:45,   max:90,   cat:"Copertura" },
};

const BONUS_CONFIG = {
  superbonus: { id:"superbonus", label:"Superbonus 65%", colore:"#22c55e", aliquota:65, massimoSpesa:96000, riferimento:"L. 213/2023 + Circ. AE 13/E/2024", condizioni:"CILAS presentata entro 31/12/2023 per condomini. Massimale 96.000€/unità. Obbligo congruità spese con asseverazione tecnica.", categorieAmmesse:["Isolamento","Impianti","Fotovoltaico","Infissi","Copertura"], note:"Obbligo doppio salto di classe energetica. Stop cessione del credito/sconto in fattura." },
  ecobonus:   { id:"ecobonus",   label:"Ecobonus / Bonus Casa 50%", colore:"#34d399", aliquota:50, massimoSpesa:60000, riferimento:"D.Lgs. 192/2005 + L. 296/2006", condizioni:"Detrazione 50% in 10 anni. Massimale da 30.000€ a 60.000€ per intervento. Congruità obbligatoria per importi > 10.000€.", categorieAmmesse:["Isolamento","Impianti","Fotovoltaico","Infissi","Copertura"], note:"Non richiede salto di classe energetica. Cumulabile con Sismabonus." },
  sismabonus: { id:"sismabonus", label:"Sismabonus", colore:"#e07b54", aliquota:85, massimoSpesa:96000, riferimento:"Art. 16 D.L. 63/2013 + D.M. 58/2017", condizioni:"50-85% in base a riduzione del rischio sismico (1 o 2 classi). Massimale 96.000€/unità. Asseverazione tecnica obbligatoria.", categorieAmmesse:["Strutturale"], note:"Zone sismiche 1, 2, 3. Asseverazione obbligatoria con modello CSLLPP. Cumulabile con Ecobonus." },
  barriere:   { id:"barriere",   label:"Bonus Barriere 75%", colore:"#a78bfa", aliquota:75, massimoSpesa:50000, riferimento:"Art. 119-ter D.L. 34/2020 + L. 213/2023", condizioni:"75% in 5 anni. Massimale 50.000€ unifamiliari, 40.000€/unità per condomini fino a 8 unità. Proroga al 31/12/2025.", categorieAmmesse:["Accessibilità"], note:"Conformità D.M. 236/1989 e L. 13/1989 obbligatoria. Titolo abilitativo appropriato necessario." },
};

const buildPrompt = (bonus, voci, regione) => {
  const cfg = BONUS_CONFIG[bonus];
  const totale = voci.reduce((s,v) => s + (parseFloat(v.prezzoUnitario)||0)*(parseFloat(v.quantita)||0), 0);
  const lines = voci.map((v,i) => {
    const ref = PREZZARIO[v.codice];
    const imp = (parseFloat(v.prezzoUnitario)||0)*(parseFloat(v.quantita)||0);
    const status = ref ? (v.prezzoUnitario < ref.min ? "SOTTO SOGLIA" : v.prezzoUnitario > ref.max ? "SOPRA SOGLIA" : "OK") : "VOCE LIBERA";
    return `${i+1}. ${v.descrizione} | Qtà: ${v.quantita} ${v.um} | €/um: ${v.prezzoUnitario} | Importo: €${imp.toFixed(2)} | Ref: ${ref ? `€${ref.min}-${ref.max}/${v.um}` : "n/d"} | Stato: ${status}`;
  }).join("\n");
  return `Sei un esperto di congruità spese per detrazioni fiscali edilizie italiane. Analizza queste voci per il ${cfg.label} (${cfg.aliquota}%, max €${cfg.massimoSpesa.toLocaleString("it-IT")}). Rif: ${cfg.riferimento}. Regione: ${regione||"media nazionale DEI"}.

VOCI:
${lines}

TOTALE: €${totale.toFixed(2)} | MASSIMALE: €${cfg.massimoSpesa.toLocaleString("it-IT")} | DETRAZIONE TEORICA (${cfg.aliquota}%): €${(Math.min(totale,cfg.massimoSpesa)*cfg.aliquota/100).toFixed(2)}

Per ogni voce valuta la congruità rispetto al prezzario DEI e ai valori di mercato. Segnala anomalie. Verifica il rispetto del massimale. Concludi con giudizio: CONGRUO / PARZIALMENTE CONGRUO / NON CONGRUO.

Formato:
📊 ANALISI PER VOCE:
💰 VERIFICA MASSIMALE:
⚖️ GIUDIZIO COMPLESSIVO:
🔴 CRITICITÀ:
✅ RACCOMANDAZIONI:

Rispondi in italiano, tono tecnico-professionale.`;
};

const EMPTY_V = { id:null, descrizione:"", codice:"", quantita:"", um:"mq", prezzoUnitario:"", note:"" };

export default function Module4() {
  const [bonus, setBonus]         = useState("superbonus");
  const [regione, setRegione]     = useState("");
  const [voci, setVoci]           = useState([]);
  const [editV, setEditV]         = useState(EMPTY_V);
  const [showForm, setShowForm]   = useState(false);
  const [analisi, setAnalisi]     = useState("");
  const [loadA, setLoadA]         = useState(false);
  const [loadP, setLoadP]         = useState(false);
  const [testo, setTesto]         = useState("");
  const [tab, setTab]             = useState("voci");
  const [filterCat, setFilterCat] = useState("Tutte");
  const [copied, setCopied]       = useState(false);
  const fileRef = useRef(null);

  const cfg = BONUS_CONFIG[bonus];
  const totale = voci.reduce((s,v) => s+(parseFloat(v.prezzoUnitario)||0)*(parseFloat(v.quantita)||0), 0);
  const detrazione = Math.min(totale, cfg.massimoSpesa) * cfg.aliquota / 100;
  const superaMax = totale > cfg.massimoSpesa;

  const vociPz = Object.entries(PREZZARIO).filter(([,v]) => (filterCat==="Tutte"||v.cat===filterCat) && cfg.categorieAmmesse.includes(v.cat));

  const saveVoce = () => {
    if (!editV.descrizione.trim()) return;
    editV.id ? setVoci(p=>p.map(x=>x.id===editV.id?editV:x)) : setVoci(p=>[...p,{...editV,id:Date.now().toString()}]);
    setEditV(EMPTY_V); setShowForm(false);
  };

  const selectPz = (codice, ref) => {
    setEditV(v=>({...v, codice, descrizione:ref.desc, um:ref.um, prezzoUnitario:Math.round((ref.min+ref.max)/2)}));
    setShowForm(true);
  };

  const runAnalysis = async () => {
    if (!voci.length) return;
    setLoadA(true); setAnalisi(""); setTab("analisi");
    try {
      const res = await fetch(PROXY_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:buildPrompt(bonus,voci,regione)}]})});
      const d = await res.json();
      setAnalisi(d.content?.[0]?.text||"Errore.");
    } catch { setAnalisi("⚠️ Errore di connessione."); }
    setLoadA(false);
  };

  const parseText = async () => {
    if (!testo.trim()) return;
    setLoadP(true);
    try {
      const res = await fetch(PROXY_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:`Estrai voci di spesa dal testo. Restituisci SOLO un JSON array (niente altro): [{"descrizione":string,"quantita":number,"um":string,"prezzoUnitario":number}]. Se mancano valori usa 0.\n\nTESTO:\n${testo}`}]})});
      const d = await res.json();
      const txt = d.content?.[0]?.text||"[]";
      const parsed = JSON.parse(txt.replace(/```json|```/g,"").trim());
      setVoci(p=>[...p,...parsed.map(v=>({...v,id:Date.now().toString()+Math.random(),codice:"",note:""}))]);
      setTesto("");
    } catch { alert("Errore nel parsing. Riprova."); }
    setLoadP(false);
  };

  const importFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setTesto(p => p + "\n" + text);
    e.target.value = "";
  };

  const badge = (v) => {
    const ref = PREZZARIO[v.codice];
    if (!ref||!v.prezzoUnitario) return null;
    const p = parseFloat(v.prezzoUnitario);
    if (p < ref.min) return {label:"Sotto soglia",color:"#6b9fd4",bg:"rgba(107,159,212,0.1)"};
    if (p > ref.max) return {label:"Sopra soglia",color:"#f87171",bg:"rgba(248,113,113,0.1)"};
    return {label:"Congruo",color:"#22c55e",bg:"rgba(34,197,94,0.1)"};
  };

  const inp = {width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 11px",color:"#d4dde8",fontSize:13,fontFamily:"'Syne',sans-serif",outline:"none"};
  const lbl = {fontSize:10,color:"rgba(201,168,76,0.7)",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,display:"block",fontWeight:600};

  return (
    <>
      <style>{`
        @keyframes m4in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        input:focus,textarea:focus,select:focus{border-color:rgba(201,168,76,0.4)!important;outline:none}
        textarea{resize:vertical}
        .pzr:hover{background:rgba(255,255,255,0.05)!important;cursor:pointer}
        .vrow:hover{background:rgba(255,255,255,0.03)!important}
        .bc:hover{transform:translateY(-1px);border-color:rgba(255,255,255,0.2)!important}
      `}</style>
      <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",background:"linear-gradient(160deg,#070d14 0%,#0b1929 60%,#08141f 100%)",position:"relative"}}>
        <div style={{position:"absolute",inset:0,pointerEvents:"none",backgroundImage:`radial-gradient(ellipse at 90% 10%,rgba(34,197,94,0.03) 0%,transparent 50%),linear-gradient(rgba(201,168,76,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,0.02) 1px,transparent 1px)`,backgroundSize:"100% 100%,60px 60px,60px 60px"}}/>

        {/* HEADER */}
        <div style={{padding:"14px 24px",borderBottom:"1px solid rgba(201,168,76,0.1)",background:"rgba(7,13,20,0.7)",backdropFilter:"blur(20px)",display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative",zIndex:5,flexShrink:0}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:"#e8d5a3"}}>Prezzari & Bonus Edilizi</div>
            <div style={{fontSize:10,color:"rgba(201,168,76,0.6)",letterSpacing:1.5,textTransform:"uppercase",marginTop:1}}>Modulo 4 · Congruità spese · Analisi AI · Prezzario DEI</div>
          </div>
          <div style={{display:"flex",gap:4}}>
            {[["voci",`📋 Computo (${voci.length})`],["analisi","🤖 Analisi congruità"]].map(([id,label])=>(
              <button key={id} onClick={()=>setTab(id)} style={{padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:tab===id?700:400,fontFamily:"'Syne',sans-serif",background:tab===id?"rgba(201,168,76,0.15)":"transparent",color:tab===id?"#C9A84C":"rgba(255,255,255,0.4)",borderBottom:tab===id?"2px solid #C9A84C":"2px solid transparent",transition:"all 0.2s"}}>{label}</button>
            ))}
          </div>
          <button onClick={runAnalysis} disabled={!voci.length||loadA} style={{padding:"8px 18px",background:!voci.length?"rgba(201,168,76,0.1)":"linear-gradient(135deg,#C9A84C,#8B6914)",border:"none",borderRadius:9,cursor:!voci.length?"not-allowed":"pointer",fontSize:12,fontWeight:700,color:!voci.length?"rgba(201,168,76,0.3)":"#070d14",fontFamily:"'Syne',sans-serif",boxShadow:voci.length?"0 2px 12px rgba(201,168,76,0.3)":"none"}}>⚡ Verifica congruità</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"20px 24px",position:"relative",zIndex:4}}>
          <div style={{maxWidth:1000,margin:"0 auto"}}>

            {/* ── TAB VOCI ── */}
            {tab==="voci" && (
              <div style={{animation:"m4in 0.3s ease-out"}}>

                {/* Selezione bonus */}
                <div style={{marginBottom:18}}>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Tipo di bonus</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
                    {Object.values(BONUS_CONFIG).map(b=>(
                      <button key={b.id} className="bc" onClick={()=>setBonus(b.id)} style={{background:bonus===b.id?`${b.colore}15`:"rgba(255,255,255,0.02)",border:`1px solid ${bonus===b.id?b.colore:"rgba(255,255,255,0.08)"}`,borderRadius:10,padding:"12px 14px",cursor:"pointer",textAlign:"left",transition:"all 0.2s"}}>
                        <div style={{fontSize:11,fontWeight:700,color:bonus===b.id?b.colore:"rgba(255,255,255,0.5)",marginBottom:2}}>{b.label}</div>
                        <div style={{fontSize:22,fontWeight:800,color:bonus===b.id?b.colore:"rgba(255,255,255,0.2)"}}>{b.aliquota}%</div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginTop:2}}>max €{b.massimoSpesa.toLocaleString("it-IT")}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info bonus */}
                <div style={{background:`${cfg.colore}08`,border:`1px solid ${cfg.colore}30`,borderRadius:10,padding:"11px 15px",marginBottom:18}}>
                  <div style={{fontSize:11,color:cfg.colore,fontWeight:600,marginBottom:3}}>{cfg.condizioni}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.28)"}}>{cfg.note} — <span style={{color:"rgba(255,255,255,0.2)"}}>{cfg.riferimento}</span></div>
                </div>

                {/* Regione + totale */}
                <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:16,marginBottom:18,alignItems:"start"}}>
                  <div>
                    <label style={lbl}>Regione / area (per taratura prezzario)</label>
                    <select style={{...inp,maxWidth:280}} value={regione} onChange={e=>setRegione(e.target.value)}>
                      <option value="">Prezzario DEI nazionale (medio)</option>
                      {["Lombardia","Veneto","Emilia-Romagna","Piemonte","Toscana","Lazio","Campania","Puglia","Sicilia","Sardegna","Altro"].map(r=><option key={r}>{r}</option>)}
                    </select>
                  </div>
                  {voci.length>0 && (
                    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"12px 18px",textAlign:"right",minWidth:210}}>
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:1}}>Totale lavori</div>
                      <div style={{fontSize:20,fontWeight:800,color:superaMax?"#f87171":"#e8d5a3",marginTop:2}}>€{totale.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                      {superaMax && <div style={{fontSize:10,color:"#f87171",marginTop:1}}>⚠ Supera massimale di €{(totale-cfg.massimoSpesa).toLocaleString("it-IT",{maximumFractionDigits:0})}</div>}
                      <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.07)"}}>
                        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:1}}>Detrazione ({cfg.aliquota}%)</div>
                        <div style={{fontSize:15,fontWeight:700,color:cfg.colore,marginTop:2}}>€{detrazione.toLocaleString("it-IT",{minimumFractionDigits:2})}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Prezzario */}
                <div style={{marginBottom:18}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#e8d5a3"}}>📖 Prezzario DEI <span style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontWeight:400}}>— clicca per aggiungere al computo</span></div>
                    <div style={{display:"flex",gap:5}}>
                      {["Tutte",...cfg.categorieAmmesse].map(c=>(
                        <button key={c} onClick={()=>setFilterCat(c)} style={{padding:"3px 10px",borderRadius:20,border:"1px solid",borderColor:filterCat===c?"#C9A84C":"rgba(255,255,255,0.1)",background:filterCat===c?"rgba(201,168,76,0.12)":"transparent",color:filterCat===c?"#C9A84C":"rgba(255,255,255,0.4)",fontSize:10,cursor:"pointer"}}>{c}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                    {vociPz.map(([codice,voce])=>(
                      <div key={codice} className="pzr" onClick={()=>selectPz(codice,voce)} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"background 0.15s"}}>
                        <div><div style={{fontSize:12,color:"#d4dde8",marginBottom:1}}>{voce.desc}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{voce.cat}</div></div>
                        <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                          <div style={{fontSize:12,fontWeight:700,color:"#C9A84C"}}>€{voce.min}–{voce.max}</div>
                          <div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>/{voce.um}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Aggiunta voci */}
                <div style={{marginBottom:18}}>
                  <div style={{display:"flex",gap:8,marginBottom:10}}>
                    <button onClick={()=>{setEditV(EMPTY_V);setShowForm(v=>!v);}} style={{padding:"8px 14px",background:"rgba(201,168,76,0.12)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:8,color:"#C9A84C",cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>
                      {showForm?"✕ Chiudi":"+ Voce manuale"}
                    </button>
                    <textarea value={testo} onChange={e=>setTesto(e.target.value)} rows={1} style={{...inp,flex:1,fontFamily:"'Crimson Pro',serif",fontSize:13,resize:"none",paddingTop:9}} placeholder='Incolla computo o testo libero... es: "Cappotto 120mq a €95/mq, infissi 8mq a €380/mq"'/>
                    <button onClick={()=>fileRef.current.click()} style={{padding:"8px 12px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:11,whiteSpace:"nowrap"}}>📁 File</button>
                    <input ref={fileRef} type="file" accept=".txt,.csv" style={{display:"none"}} onChange={importFile}/>
                    <button onClick={parseText} disabled={!testo.trim()||loadP} style={{padding:"8px 14px",background:!testo.trim()?"rgba(201,168,76,0.1)":"linear-gradient(135deg,#C9A84C,#8B6914)",border:"none",borderRadius:8,cursor:!testo.trim()?"not-allowed":"pointer",fontSize:12,fontWeight:700,color:!testo.trim()?"rgba(201,168,76,0.3)":"#070d14",whiteSpace:"nowrap",fontFamily:"'Syne',sans-serif"}}>
                      {loadP?"⏳ AI...":"🤖 Importa con AI"}
                    </button>
                  </div>

                  {showForm && (
                    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:10,padding:"14px 16px",animation:"m4in 0.2s ease-out"}}>
                      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:10}}>
                        <div><label style={lbl}>Descrizione *</label><input style={inp} value={editV.descrizione} onChange={e=>setEditV(v=>({...v,descrizione:e.target.value}))} placeholder="es. Cappotto EPS 10cm, posa inclusa"/></div>
                        <div><label style={lbl}>Quantità</label><input style={inp} type="number" value={editV.quantita} onChange={e=>setEditV(v=>({...v,quantita:e.target.value}))} placeholder="120"/></div>
                        <div>
                          <label style={lbl}>U.M.</label>
                          <select style={{...inp,cursor:"pointer"}} value={editV.um} onChange={e=>setEditV(v=>({...v,um:e.target.value}))}>
                            {["mq","ml","mc","cad","kW","kWp","kWh","kg","corpo"].map(u=><option key={u}>{u}</option>)}
                          </select>
                        </div>
                        <div><label style={lbl}>Prezzo €/um</label><input style={inp} type="number" value={editV.prezzoUnitario} onChange={e=>setEditV(v=>({...v,prezzoUnitario:e.target.value}))} placeholder="95"/></div>
                      </div>
                      <div style={{marginTop:10}}><label style={lbl}>Note</label><input style={inp} value={editV.note} onChange={e=>setEditV(v=>({...v,note:e.target.value}))} placeholder="es. Incluso ponteggio, finitura rasata..."/></div>
                      <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"flex-end"}}>
                        <button onClick={()=>{setShowForm(false);setEditV(EMPTY_V);}} style={{padding:"7px 14px",background:"transparent",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:12}}>Annulla</button>
                        <button onClick={saveVoce} disabled={!editV.descrizione.trim()} style={{padding:"7px 18px",background:"linear-gradient(135deg,#C9A84C,#8B6914)",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,color:"#070d14",fontFamily:"'Syne',sans-serif"}}>+ Aggiungi</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tabella voci */}
                {voci.length>0 ? (
                  <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,overflow:"hidden"}}>
                    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr auto",padding:"8px 16px",borderBottom:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)"}}>
                      {["Descrizione","Q.tà","U.M.","€/um","Importo",""].map((h,i)=><div key={i} style={{fontSize:9,color:"rgba(201,168,76,0.6)",textTransform:"uppercase",letterSpacing:1.2,fontWeight:700}}>{h}</div>)}
                    </div>
                    {voci.map((v,i)=>{
                      const b=badge(v);
                      const imp=(parseFloat(v.prezzoUnitario)||0)*(parseFloat(v.quantita)||0);
                      return (
                        <div key={v.id} className="vrow" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr auto",padding:"10px 16px",borderBottom:i<voci.length-1?"1px solid rgba(255,255,255,0.05)":"none",alignItems:"center",transition:"background 0.15s"}}>
                          <div>
                            <div style={{fontSize:12,color:"#d4dde8"}}>{v.descrizione}</div>
                            {b && <span style={{fontSize:9,padding:"1px 7px",borderRadius:20,background:b.bg,border:`1px solid ${b.color}40`,color:b.color,marginTop:3,display:"inline-block"}}>{b.label}</span>}
                          </div>
                          <div style={{fontSize:12,color:"#d4dde8"}}>{v.quantita||"—"}</div>
                          <div style={{fontSize:12,color:"rgba(255,255,255,0.45)"}}>{v.um}</div>
                          <div style={{fontSize:12,color:"#d4dde8"}}>{v.prezzoUnitario?`€${parseFloat(v.prezzoUnitario).toFixed(2)}`:"—"}</div>
                          <div style={{fontSize:12,fontWeight:600,color:"#C9A84C"}}>€{imp.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                          <div style={{display:"flex",gap:4}}>
                            <button onClick={()=>{setEditV(v);setShowForm(true);}} style={{padding:"3px 8px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:5,color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:10}}>✏️</button>
                            <button onClick={()=>setVoci(p=>p.filter(x=>x.id!==v.id))} style={{padding:"3px 8px",background:"rgba(248,113,113,0.07)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:5,color:"#f87171",cursor:"pointer",fontSize:10}}>🗑</button>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr auto",padding:"11px 16px",background:"rgba(201,168,76,0.07)",borderTop:"1px solid rgba(201,168,76,0.2)"}}>
                      <div style={{fontSize:12,fontWeight:700,color:"#e8d5a3"}}>TOTALE LAVORI</div>
                      <div/><div/><div/>
                      <div style={{fontSize:14,fontWeight:800,color:superaMax?"#f87171":"#C9A84C"}}>€{totale.toLocaleString("it-IT",{minimumFractionDigits:2})}</div>
                      <div/>
                    </div>
                    <div style={{padding:"10px 16px",borderTop:"1px solid rgba(255,255,255,0.06)",display:"flex",gap:20,alignItems:"center"}}>
                      <span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>Massimale: <strong style={{color:"rgba(255,255,255,0.5)"}}>€{cfg.massimoSpesa.toLocaleString("it-IT")}</strong>{superaMax&&<span style={{color:"#f87171",fontSize:10}}> ⚠ eccedenza €{(totale-cfg.massimoSpesa).toLocaleString("it-IT",{maximumFractionDigits:0})}</span>}</span>
                      <span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>Detrazione ({cfg.aliquota}%): <strong style={{color:cfg.colore}}>€{detrazione.toLocaleString("it-IT",{minimumFractionDigits:2})}</strong></span>
                      <button onClick={()=>setVoci([])} style={{marginLeft:"auto",padding:"4px 12px",background:"rgba(248,113,113,0.07)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:7,color:"#f87171",cursor:"pointer",fontSize:11}}>🗑 Svuota</button>
                    </div>
                  </div>
                ) : (
                  <div style={{textAlign:"center",padding:"36px 20px",color:"rgba(255,255,255,0.2)",fontFamily:"'Crimson Pro',serif"}}>
                    <div style={{fontSize:36,marginBottom:10}}>📋</div>
                    <div style={{fontSize:14}}>Nessuna voce inserita</div>
                    <div style={{fontSize:12,marginTop:4}}>Clicca su una voce del prezzario, aggiungila manualmente, o incolla un computo e usa "Importa con AI"</div>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB ANALISI ── */}
            {tab==="analisi" && (
              <div style={{animation:"m4in 0.3s ease-out"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                  <div>
                    <div style={{fontSize:17,fontWeight:800,color:"#e8d5a3"}}>🤖 Analisi di Congruità AI</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.3)",fontFamily:"'Crimson Pro',serif",marginTop:2}}>{cfg.label} · {voci.length} voci · €{totale.toLocaleString("it-IT",{maximumFractionDigits:2})} totale</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    {analisi && <button onClick={()=>{navigator.clipboard.writeText(analisi);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{padding:"8px 14px",background:copied?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.05)",border:`1px solid ${copied?"rgba(34,197,94,0.4)":"rgba(255,255,255,0.1)"}`,borderRadius:8,color:copied?"#22c55e":"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:12}}>{copied?"✓ Copiato":"📋 Copia"}</button>}
                    <button onClick={runAnalysis} disabled={loadA} style={{padding:"8px 16px",background:loadA?"rgba(201,168,76,0.1)":"linear-gradient(135deg,#C9A84C,#8B6914)",border:"none",borderRadius:8,cursor:loadA?"not-allowed":"pointer",fontSize:12,fontWeight:700,color:loadA?"#C9A84C":"#070d14",fontFamily:"'Syne',sans-serif"}}>{loadA?"⏳ Analisi...":"↻ Rigenera"}</button>
                  </div>
                </div>

                {loadA && (
                  <div style={{textAlign:"center",padding:"60px 20px"}}>
                    <div style={{width:220,height:4,background:"rgba(255,255,255,0.07)",borderRadius:2,overflow:"hidden",margin:"0 auto 16px"}}>
                      <div style={{height:"100%",background:"linear-gradient(90deg,transparent,#C9A84C,transparent)",backgroundSize:"200% 100%",animation:"shimmer 1.5s infinite",borderRadius:2}}/>
                    </div>
                    <div style={{fontSize:13,color:"rgba(201,168,76,0.6)",fontFamily:"'Crimson Pro',serif"}}>Verifica congruità in corso...</div>
                  </div>
                )}

                {!loadA && !analisi && (
                  <div style={{textAlign:"center",padding:"60px 20px",color:"rgba(255,255,255,0.2)",fontFamily:"'Crimson Pro',serif"}}>
                    <div style={{fontSize:36,marginBottom:10}}>⚡</div>
                    <div style={{fontSize:14}}>Premi "Verifica congruità" per avviare l'analisi</div>
                  </div>
                )}

                {!loadA && analisi && (
                  <>
                    <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"26px 30px",fontFamily:"'Crimson Pro',Georgia,serif",fontSize:14,lineHeight:1.85,color:"#d4dde8",whiteSpace:"pre-wrap",letterSpacing:0.15}}>
                      {analisi}
                    </div>
                    <div style={{marginTop:12,padding:"10px 16px",background:"rgba(201,168,76,0.05)",border:"1px solid rgba(201,168,76,0.12)",borderRadius:8,fontSize:11,color:"rgba(201,168,76,0.55)"}}>
                      ⚠️ Analisi orientativa basata sul prezzario DEI 2024. La congruità definitiva richiede asseverazione tecnica ai sensi del D.M. 6 agosto 2020. La responsabilità rimane al professionista firmatario.
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
