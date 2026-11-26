import { handlePreview } from '../../api/lib/handlers.mjs';

export default (req) => handlePreview(req);
export const config = { path: '/api/chart/preview' };
