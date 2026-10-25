// Grading-weight math (same rules as the web's grading-weights.ts).
//
// A component's weightPercent is its share of the grade; an item's weightPercent is its share of
// that component. componentTotal = sum(item weights); schemeTotal = sum(component weight *
// componentTotal / 100). A scheme is only usable when its total is exactly 100%.

export const sumItemWeights = (items: { weightPercent: number }[]): number =>
  items.reduce((sum, item) => sum + (Number(item.weightPercent) || 0), 0);

export const computeComponentContribution = (componentWeight: number, itemTotal: number): number =>
  ((Number(componentWeight) || 0) * (Number(itemTotal) || 0)) / 100;

export const computeSchemeWeightTotal = (
  components: { id: string; weightPercent: number }[],
  itemTotalsByComponentId: Map<string, number>
): number =>
  components.reduce(
    (sum, c) => sum + computeComponentContribution(c.weightPercent, itemTotalsByComponentId.get(c.id) ?? 0),
    0
  );

/** Rounded to two decimals first, so 33.33 + 33.33 + 33.34 counts as 100 and 99.99 does not */
export const isWeightTotalComplete = (total: number): boolean => Math.round(total * 100) / 100 === 100;

export const formatWeightTotal = (total: number): string => String(Math.round(total * 100) / 100);
