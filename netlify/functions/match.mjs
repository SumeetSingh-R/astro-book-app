import { handleMatch } from '../../api/lib/handlers.mjs';
import { createDb } from '../../api/lib/db.mjs';
import { translator } from '../../api/lib/i18n.mjs';

export default (req) => handleMatch(req, { createDb, translator });
export const config = { path: '/api/match' };
