import { handlePush } from '../../api/lib/handlers.mjs';
import { createDb } from '../../api/lib/db.mjs';
import { createPush } from '../../api/lib/push.mjs';

export default (req) => handlePush(req, { createDb, push: createPush() });
export const config = { path: '/api/push' };
