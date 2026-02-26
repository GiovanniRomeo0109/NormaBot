import { useState } from "react";
import Module1 from "./modules/Module1";
import Module2 from "./modules/Module2";
import Module3 from "./modules/Module3";
import Module4 from "./modules/Module4";

const MODULES = [
  {
    id: 1,
    icon: "⚖️",
    label: "Chat Normativa",
    sublabel: "CILA · SCIA · PdC",
    description: "Determina il titolo abilitativo corretto",
    status: "active",
  },
  {
    id: 2,
    icon: "📄",
    label: "Compilazione Documenti",
    sublabel: "Asseverazioni · Relazioni",
    description: "Genera bozze di documenti tecnici",
    status: "active",
  },
  {
    id: 3,
    icon: "🔔",
    label: "Monitor Normativo",
    sublabel: "Aggiornamenti · Alert",
    description: "Tieni traccia delle variazioni normative",
    status: "active",
  },
  {
    id: 4,
    icon: "📊",
    label: "Prezzari & Bonus",
    sublabel: "Congruità · Superbonus",
    description: "Verifica le voci di spesa per i bonus",
    status: "active",
  },
];

export default function App() {
  const [activeModule, setActiveModule] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const renderModule = () => {
    switch (activeModule) {
      case 1: return <Module1 />;
      case 2: return <Module2 />;
      case 3: return <Module3 />;
      case 4: return <Module4 />;
      default: return <Module1 />;
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&family=Syne:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { background: #070d14; font-family: 'Syne', sans-serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.3); border-radius: 4px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#070d14" }}>

        {/* SIDEBAR */}
        <aside style={{
          width: sidebarOpen ? 260 : 72,
          flexShrink: 0,
          background: "rgba(8,14,22,0.98)",
          borderRight: "1px solid rgba(201,168,76,0.12)",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
          overflow: "hidden",
          position: "relative",
          zIndex: 20,
        }}>

          {/* Logo area */}
          <div style={{
            padding: sidebarOpen ? "20px 20px 16px" : "20px 16px 16px",
            borderBottom: "1px solid rgba(201,168,76,0.1)",
            display: "flex", alignItems: "center", gap: 12,
            justifyContent: sidebarOpen ? "flex-start" : "center"
          }}>
            <div style={{
              width: 38, height: 38, flexShrink: 0,
              background: "linear-gradient(135deg, #C9A84C, #6b4d10)",
              borderRadius: 9, display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 18, boxShadow: "0 4px 14px rgba(201,168,76,0.25)"
            }}>⚖️</div>
            {sidebarOpen && (
              <div style={{ animation: "fadeIn 0.2s ease-out" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#e8d5a3", letterSpacing: -0.3, lineHeight: 1 }}>NormaBot</div>
                <div style={{ fontSize: 9, color: "#C9A84C", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2, opacity: 0.7 }}>Agente Edilizio AI</div>
              </div>
            )}
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
            {sidebarOpen && (
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: 2, textTransform: "uppercase", padding: "4px 8px 8px" }}>
                Moduli
              </div>
            )}
            {MODULES.map(mod => {
              const isActive = activeModule === mod.id;
              const isSoon = mod.status === "soon";
              return (
                <button key={mod.id}
                  onClick={() => !isSoon && setActiveModule(mod.id)}
                  title={!sidebarOpen ? mod.label : ""}
                  style={{
                    width: "100%",
                    background: isActive
                      ? "linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.06))"
                      : "transparent",
                    border: isActive ? "1px solid rgba(201,168,76,0.25)" : "1px solid transparent",
                    borderRadius: 10,
                    padding: sidebarOpen ? "10px 12px" : "10px",
                    cursor: isSoon ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: sidebarOpen ? "flex-start" : "center",
                    justifyContent: sidebarOpen ? "flex-start" : "center",
                    gap: 10,
                    opacity: isSoon ? 0.45 : 1,
                    transition: "all 0.2s",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => { if (!isSoon && !isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1, marginTop: sidebarOpen ? 1 : 0 }}>{mod.icon}</span>
                  {sidebarOpen && (
                    <div style={{ animation: "fadeIn 0.2s ease-out", minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 700,
                        color: isActive ? "#e8d5a3" : "rgba(255,255,255,0.6)",
                        lineHeight: 1.2, whiteSpace: "nowrap"
                      }}>{mod.label}</div>
                      <div style={{ fontSize: 10, color: isActive ? "#C9A84C" : "rgba(255,255,255,0.25)", marginTop: 2, letterSpacing: 0.3 }}>
                        {isSoon ? "Prossimamente" : mod.sublabel}
                      </div>
                    </div>
                  )}
                  {isActive && !sidebarOpen && (
                    <div style={{
                      position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                      width: 3, height: 24, background: "#C9A84C", borderRadius: "0 3px 3px 0"
                    }} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom info */}
          <div style={{
            padding: sidebarOpen ? "12px 20px" : "12px 16px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", gap: 8,
            justifyContent: sidebarOpen ? "flex-start" : "center"
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#22c55e", animation: "pulse 2s infinite", flexShrink: 0
            }} />
            {sidebarOpen && (
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", animation: "fadeIn 0.2s" }}>
                Salva Casa 2024 · D.P.R. 380/2001
              </span>
            )}
          </div>

          {/* Toggle button */}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            position: "absolute", top: 24, right: -12,
            width: 24, height: 24, borderRadius: "50%",
            background: "#0f1f30",
            border: "1px solid rgba(201,168,76,0.25)",
            color: "rgba(201,168,76,0.6)",
            cursor: "pointer", fontSize: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
            zIndex: 30,
          }}>
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </aside>

        {/* MAIN CONTENT */}
        <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {renderModule()}
        </main>
      </div>
    </>
  );
}
