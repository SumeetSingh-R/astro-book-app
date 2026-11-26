import { handleMatch } from '../../api/lib/handlers.mjs';
import { createDb } from '../../api/lib/db.mjs';

export default (req) => handleMatch(req, { createDb });
export const config = { path: '/api/match' };
