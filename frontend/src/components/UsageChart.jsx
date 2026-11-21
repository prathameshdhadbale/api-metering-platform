import { lazy, Suspense } from 'react';
import { LoadingState } from './Ui.jsx';

const ChartImplementation = lazy(() => import('./UsageChartImplementation.jsx'));

export default function UsageChart({ rows = [], height = 250 }) {
  return <div className="chart-wrap" style={{ height }}>
    <Suspense fallback={<LoadingState label="Loading chart"/>}><ChartImplementation rows={rows}/></Suspense>
  </div>;
}
