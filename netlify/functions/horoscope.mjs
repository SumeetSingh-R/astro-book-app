import { handleHoroscope } from '../../api/lib/handlers.mjs';

export default (req) => handleHoroscope(req);
export const config = { path: '/api/horoscope' };
