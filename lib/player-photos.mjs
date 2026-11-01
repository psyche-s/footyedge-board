// ESM compatibility for scripts and tests; deployed API routes use the CommonJS helper.
import photos from "./player-photos.cjs";
const {validPlayerImageURL,photoForIdentity}=photos;
export {validPlayerImageURL,photoForIdentity};
