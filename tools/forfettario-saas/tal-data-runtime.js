import { auth } from './auth-runtime.js';
import { createTalDataService, createTalDataController } from './tal-data-service.js';
const service = createTalDataService({ auth, fetchImpl: window.fetch.bind(window) });
export const cloud = createTalDataController({ auth, service });
