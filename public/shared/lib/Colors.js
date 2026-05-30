export const COLORS = ['#e94560', '#0f3460', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4'];

export function getPlayerColor(index) {
  return COLORS[index % COLORS.length];
}

export function getPlayerColorRgba(index, alpha = 1) {
  const hex = getPlayerColor(index);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
