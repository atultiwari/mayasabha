// Picks the home-Wi-Fi address(es) a phone can use to reach this computer. Node-only helper, kept
// pure (takes the os.networkInterfaces() result) so it can be unit-tested.

const PRIVATE_RANGES = [/^192\.168\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./];

function rank(address) {
  const i = PRIVATE_RANGES.findIndex((re) => re.test(address));
  return i === -1 ? PRIVATE_RANGES.length : i;
}

/**
 * @param {Record<string, {address:string, family:string|number, internal:boolean}[]>} interfaces
 * @returns {string[]} IPv4 LAN addresses, likeliest home-Wi-Fi first (link-local 169.254.* dropped)
 */
export function lanAddresses(interfaces) {
  return Object.values(interfaces ?? {})
    .flat()
    .filter((i) => i && (i.family === 'IPv4' || i.family === 4) && !i.internal && !i.address.startsWith('169.254.'))
    .map((i) => i.address)
    .filter((a, idx, all) => all.indexOf(a) === idx)
    .sort((a, b) => rank(a) - rank(b));
}

/** @returns {string[]} phone-remote URLs for each LAN address */
export function remoteUrls(addresses, port) {
  return addresses.map((ip) => `http://${ip}:${port}/remote/`);
}
