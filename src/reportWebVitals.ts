import { onCLS, onFCP, onLCP, onTTFB, type CLSMetric, type FCPMetric, type LCPMetric, type TTFBMetric } from 'web-vitals';

type Metric = CLSMetric | FCPMetric | LCPMetric | TTFBMetric;

const reportWebVitals = (onPerfEntry?: (metric: Metric) => void) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    onCLS(onPerfEntry);
    onFCP(onPerfEntry);
    onLCP(onPerfEntry);
    onTTFB(onPerfEntry);
  }
};

export default reportWebVitals;
