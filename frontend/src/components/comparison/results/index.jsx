import { ResultsSummary } from "./ResultsSummary";
import { BestWeightsSection } from "./BestWeightsSection";
import { StandardConfigResults } from "./StandardConfigResults";
import { OptimizedHighROIResults } from "./OptimizedHighROIResults";

// ComparisonResults: gabungkan seluruh blok hasil comparison dalam satu wrapper.
export function ComparisonResults({ displayData }) {
  return (
    <>
      <ResultsSummary displayData={displayData} />
      <BestWeightsSection displayData={displayData} />
      <StandardConfigResults displayData={displayData} />
      <OptimizedHighROIResults displayData={displayData} />
    </>
  );
}
