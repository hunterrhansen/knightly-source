// The layered renderer is native only; web keeps the classic board (Skia on
// web would need CanvasKit).
export function PieceLayer(_props: Record<string, unknown>) {
  return null;
}
export const layeredSupported = false;
