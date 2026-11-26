import { handleReading } from '../../api/lib/handlers.mjs';
import { createDb } from '../../api/lib/db.mjs';
import { createAi } from '../../api/lib/ai.mjs';

export default (req) => handleReading(req, { createDb, ai: createAi() });
export const config = { path: '/api/reading' };
