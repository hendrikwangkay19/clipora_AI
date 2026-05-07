export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.23),
        background: "var(--accent)",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 0,
          height: 0,
          marginLeft: Math.round(size * 0.07),
          borderTop: `${Math.round(size * 0.22)}px solid transparent`,
          borderBottom: `${Math.round(size * 0.22)}px solid transparent`,
          borderLeft: `${Math.round(size * 0.37)}px solid #fff`,
        }}
      />
    </span>
  );
}
