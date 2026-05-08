export type ObchodStatus =
  | "v_procese"
  | "pred_podpisom_kz"
  | "podpisane"
  | "vklad"
  | "ukoncene"
  | "zruseny";

export interface UlohaForStatus {
  kategoria: string;
  nazov: string;
  done: boolean;
}

export const OBCHOD_STATUS_LABELS: Record<ObchodStatus, string> = {
  v_procese:        "V procese",
  pred_podpisom_kz: "Pred podpisom KZ",
  podpisane:        "Podpísané",
  vklad:            "Vklad podaný",
  ukoncene:         "Ukončené",
  zruseny:          "Zrušený",
};

export const OBCHOD_STATUS_COLORS: Record<ObchodStatus, string> = {
  v_procese:        "#3B82F6",
  pred_podpisom_kz: "#F59E0B",
  podpisane:        "#8B5CF6",
  vklad:            "#0891B2",
  ukoncene:         "#059669",
  zruseny:          "#6B7280",
};

/** Vypočíta nový status obchodu na základe hotových úloh. */
export function computeObchodStatus(ulohy: UlohaForStatus[]): ObchodStatus {
  const isDone = (nazov: string) =>
    ulohy.some(u => u.nazov.toLowerCase().includes(nazov.toLowerCase()) && u.done);

  const allAmlDone = ulohy
    .filter(u => u.kategoria === "aml")
    .every(u => u.done);

  const kzPodpisana = isDone("KZ → notár") || isDone("kúpna zmluva");
  const navrhNaVklad = isDone("návrh na vklad");

  if (allAmlDone && kzPodpisana && navrhNaVklad) return "vklad";
  if (allAmlDone && kzPodpisana) return "podpisane";
  if (allAmlDone) return "pred_podpisom_kz";
  return "v_procese";
}
