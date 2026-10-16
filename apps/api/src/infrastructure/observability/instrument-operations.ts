import { initializeErrorReporting } from './error-reporting.js';
import { loadObservabilityEnvironment } from './load-environment.js';
loadObservabilityEnvironment();
initializeErrorReporting('operations');
