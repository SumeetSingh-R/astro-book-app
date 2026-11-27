import { handleReading } from '../../api/lib/handlers.mjs';
import { createDb } from '../../api/lib/db.mjs';
import { createAi } from '../../api/lib/ai.mjs';
import { translator } from '../../api/lib/i18n.mjs';

export default (req) => handleReading(req, { createDb, ai: createAi(), translator });
export const config = { path: '/api/reading' };
