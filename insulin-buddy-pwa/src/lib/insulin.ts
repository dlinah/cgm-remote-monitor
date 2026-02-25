export interface DoseResult {
  carbDose: number;
  correction: number;
  iob: number;
  totalDose: number;
}

export function calculateDose(
  mealCarbs: number,
  carbRatio: number,
  currentBg: number,
  targetBg: number,
  isf: number,
  iob: number
): DoseResult {
  const carbDose = carbRatio > 0 ? mealCarbs / carbRatio : 0;
  const correction = isf > 0 ? (currentBg - targetBg) / isf : 0;
  const totalDose = Math.max(0, carbDose + correction - iob);

  return {
    carbDose: Math.round(carbDose * 100) / 100,
    correction: Math.round(correction * 100) / 100,
    iob,
    totalDose: Math.round(totalDose * 100) / 100,
  };
}
