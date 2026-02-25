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
  iobCarb: number,
  iobCorr: number
): DoseResult {
  const carbDose = carbRatio > 0 ? mealCarbs / carbRatio : 0;
  const iob = iobCarb + iobCorr;
  let correction = isf > 0 ? (currentBg - targetBg) / isf : 0;

  if (currentBg > targetBg) {
    if (correction <= iobCarb) {
      correction = -iobCorr;
    } else {
      correction = correction - iob;
    }
  } else {
    correction = correction - iobCorr;
  }

  const totalDose = carbDose + correction;

  return {
    carbDose: Math.round(carbDose * 100) / 100,
    correction: Math.round(correction * 100) / 100,
    iob: Math.round(iob * 100) / 100,
    totalDose: Math.round(totalDose * 100) / 100,
  };
}
