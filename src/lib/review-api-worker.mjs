import { analyzeApiFlows } from './review-api-flows.mjs';
self.onmessage = async event => {
  try { self.postMessage({ result: await analyzeApiFlows(event.data.files) }); }
  catch { self.postMessage({ error: 'API analysis failed. File groups remain available.' }); }
};
