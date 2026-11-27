import { handleHoroscope } from '../../api/lib/handlers.mjs';
import { translator } from '../../api/lib/i18n.mjs';

export default (req) => handleHoroscope(req, { translator });
export const config = { path: '/api/horoscope' };
