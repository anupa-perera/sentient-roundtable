/**
 * Model color palette for consistent visual identity per model across the UI.
 * Each model gets a unique color based on its position in the selected list.
 */

export interface ModelColor {
  bg: string;
  text: string;
  ring: string;
  border: string;
  hex: string;
}

const PALETTE: ModelColor[] = [
  { bg: "bg-orange-500", text: "text-orange-400", ring: "ring-orange-500/20", border: "border-orange-500/30", hex: "#f97316" },
  { bg: "bg-cyan-500", text: "text-cyan-400", ring: "ring-cyan-500/20", border: "border-cyan-500/30", hex: "#06b6d4" },
  { bg: "bg-violet-500", text: "text-violet-400", ring: "ring-violet-500/20", border: "border-violet-500/30", hex: "#8b5cf6" },
  { bg: "bg-emerald-500", text: "text-emerald-400", ring: "ring-emerald-500/20", border: "border-emerald-500/30", hex: "#10b981" },
  { bg: "bg-rose-500", text: "text-rose-400", ring: "ring-rose-500/20", border: "border-rose-500/30", hex: "#f43f5e" },
  { bg: "bg-blue-500", text: "text-blue-400", ring: "ring-blue-500/20", border: "border-blue-500/30", hex: "#3b82f6" },
  { bg: "bg-amber-500", text: "text-amber-400", ring: "ring-amber-500/20", border: "border-amber-500/30", hex: "#f59e0b" },
  { bg: "bg-fuchsia-500", text: "text-fuchsia-400", ring: "ring-fuchsia-500/20", border: "border-fuchsia-500/30", hex: "#d946ef" }
];

export function getModelColor(modelId: string, allModels: string[]): ModelColor {
  const index = allModels.indexOf(modelId);
  return PALETTE[(index >= 0 ? index : 0) % PALETTE.length];
}

export function getModelInitial(modelId: string): string {
  const parts = modelId.split("/");
  const name = parts.length > 1 ? parts[1] : parts[0];
  return name.substring(0, 2).toUpperCase();
}

export function getModelShortName(modelId: string): string {
  const parts = modelId.split("/");
  return parts.length > 1 ? parts[1] : parts[0];
}
