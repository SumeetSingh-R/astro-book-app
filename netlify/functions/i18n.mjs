import { handleI18n } from '../../api/lib/handlers.mjs';
import { translator, loadCatalog } from '../../api/lib/i18n.mjs';

export default (req) => handleI18n(req, { translator, loadCatalog });
export const config = { path: '/api/i18n' };
