// Plus Codes (Open Location Code), the address format that works where
// street addresses do not.
//
// In Fuwa an address is a description — "past the university, turn right at
// the clinic" — and a Plus Code is a short string that Google Maps resolves
// to the exact spot. Customers searching for the restaurant paste it into
// Maps. Computing it from the stored coordinates, rather than typing it in,
// means it can never disagree with the map pin.
//
// Only encoding, only the ten-digit form (about 14 × 14 metres), which is what
// Maps prints. Written against the published algorithm and checked against
// its test vectors in tests/unit/plus-code.test.ts.

const ALPHABET = "23456789CFGHJMPQRVWX";
const PAIRS = 5;

/** The full ten-digit code, e.g. `7H6FF2QV+MQ`. */
export function encodePlusCode(latitude: number, longitude: number): string {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new RangeError("Latitude and longitude must be finite numbers");
  }
  const lat = Math.min(Math.max(latitude, -90), 90 - 1e-9) + 90;
  const lng = ((((longitude + 180) % 360) + 360) % 360);

  // Each of the five pairs is a base-20 digit of latitude and of longitude;
  // 8000 cells per degree at ten digits.
  let latCell = Math.floor(Math.round(lat * 8000 * 1e6) / 1e6);
  let lngCell = Math.floor(Math.round(lng * 8000 * 1e6) / 1e6);

  let code = "";
  for (let pair = 0; pair < PAIRS; pair += 1) {
    code = ALPHABET[lngCell % 20] + code;
    code = ALPHABET[latCell % 20] + code;
    latCell = Math.floor(latCell / 20);
    lngCell = Math.floor(lngCell / 20);
  }
  return `${code.slice(0, 8)}+${code.slice(8)}`;
}

/**
 * The form people actually use: the first four characters dropped, because
 * Maps restores them from "near here". `F2QV+MQ`.
 */
export function shortPlusCode(latitude: number, longitude: number): string {
  return encodePlusCode(latitude, longitude).slice(4);
}
