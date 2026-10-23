export function isHexColor(value: string): boolean {
  return /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(value);
}

export function HexColorPreview({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      title={color}
      className="mr-1 inline-block h-3 w-3 overflow-hidden rounded-sm border border-current align-middle"
      style={{
        background:
          "repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 0 / 6px 6px",
      }}
    >
      <span
        className="block h-full w-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}
