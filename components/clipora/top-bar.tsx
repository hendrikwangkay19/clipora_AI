interface TopBarProps {
  title?: string;
}

export function TopBar({ title }: TopBarProps) {
  return (
    <header
      style={{
        height: 56,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div>
        {title ? (
          <h1
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text)",
            }}
          >
            {title}
          </h1>
        ) : (
          <span
            style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}
          >
            Clipora
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Status badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            borderRadius: 999,
            background: "var(--accent-light)",
            border: "1px solid rgba(74,122,101,0.18)",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--accent)",
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
            MVP Local
          </span>
        </div>

        {/* User avatar */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--gold), var(--accent))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 800,
            color: "#fff",
          }}
        >
          H
        </div>
      </div>
    </header>
  );
}
