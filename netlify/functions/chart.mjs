import { handleChart } from '../../api/lib/handlers.mjs';
import { createDb } from '../../api/lib/db.mjs';

export default (req) => handleChart(req, { createDb });
export const config = { path: '/api/chart' };
