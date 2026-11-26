import { handlePlaces } from '../../api/lib/handlers.mjs';

let dataset;
const loadPlaces = async () => (dataset ??= (await import('../../api/data/places.generated.mjs')).default);

export default (req) => handlePlaces(req, { loadPlaces });
export const config = { path: '/api/places' };
