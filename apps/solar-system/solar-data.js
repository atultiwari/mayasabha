// Solar-system facts: real orbital periods, sizes, tilts and spin, plus names and one child-friendly
// fact per body in English and Hindi. Sources: NASA planetary fact sheets (rounded).
//   radiusKm   mean radius          periodDays  orbit around the parent (sidereal)
//   au         mean distance (planets, astronomical units)
//   dayHours   spin period (negative = spins backwards)   tiltDeg  axial tilt

export const SUN = Object.freeze({
  id: 'sun', radiusKm: 696000, dayHours: 609, texture: '2k_sun.jpg',
  name: { en: 'The Sun', hi: 'सूरज' },
  fact: {
    en: 'The Sun is a star. It gives us light and keeps us warm.',
    hi: 'सूरज एक तारा है। यह हमें रोशनी और गर्मी देता है।',
  },
});

export const PLANETS = Object.freeze([
  {
    id: 'mercury', radiusKm: 2440, au: 0.39, periodDays: 88, dayHours: 1408, tiltDeg: 0.03, texture: '2k_mercury.jpg',
    name: { en: 'Mercury', hi: 'बुध' },
    fact: { en: 'Mercury is the smallest planet, and the closest to the Sun.', hi: 'बुध सबसे छोटा ग्रह है, और सूरज के सबसे पास है।' },
    moons: [],
  },
  {
    id: 'venus', radiusKm: 6052, au: 0.72, periodDays: 224.7, dayHours: -5832, tiltDeg: 177.4, texture: '2k_venus_atmosphere.jpg',
    name: { en: 'Venus', hi: 'शुक्र' },
    fact: { en: 'Venus is the hottest planet, wrapped in thick clouds.', hi: 'शुक्र सबसे गरम ग्रह है, घने बादलों से ढका हुआ।' },
    moons: [],
  },
  {
    id: 'earth', radiusKm: 6371, au: 1, periodDays: 365.25, dayHours: 23.93, tiltDeg: 23.4, texture: '2k_earth_daymap.jpg', clouds: '2k_earth_clouds.jpg',
    name: { en: 'Earth', hi: 'पृथ्वी' },
    fact: { en: 'Earth is our home. It has water, air, and lots of life!', hi: 'पृथ्वी हमारा घर है। यहाँ पानी, हवा और बहुत सारा जीवन है!' },
    moons: [{
      id: 'moon', radiusKm: 1737, periodDays: 27.32, texture: '2k_moon.jpg',
      name: { en: 'The Moon', hi: 'चंदा मामा' },
      fact: { en: 'The Moon goes round the Earth. There is no air on the Moon.', hi: 'चंदा मामा पृथ्वी के चारों ओर घूमते हैं। चाँद पर हवा नहीं है।' },
    }],
  },
  {
    id: 'mars', radiusKm: 3390, au: 1.52, periodDays: 687, dayHours: 24.62, tiltDeg: 25.2, texture: '2k_mars.jpg',
    name: { en: 'Mars', hi: 'मंगल' },
    fact: { en: 'Mars is the red planet. Its red dust makes the sky pink!', hi: 'मंगल लाल ग्रह है। इसकी लाल धूल से आसमान गुलाबी दिखता है!' },
    moons: [
      { id: 'phobos', radiusKm: 11, periodDays: 0.32, color: '#8a7a6a', name: { en: 'Phobos', hi: 'फोबोस' } },
      { id: 'deimos', radiusKm: 6, periodDays: 1.26, color: '#a39484', name: { en: 'Deimos', hi: 'डीमोस' } },
    ],
  },
  {
    id: 'jupiter', radiusKm: 69911, au: 5.2, periodDays: 4333, dayHours: 9.93, tiltDeg: 3.1, texture: '2k_jupiter.jpg',
    name: { en: 'Jupiter', hi: 'बृहस्पति' },
    fact: { en: 'Jupiter is the biggest planet. All the others could fit inside it!', hi: 'बृहस्पति सबसे बड़ा ग्रह है। बाकी सारे ग्रह इसके अंदर समा सकते हैं!' },
    moons: [
      { id: 'io', radiusKm: 1822, periodDays: 1.77, color: '#e8d35a', name: { en: 'Io', hi: 'आयो' } },
      { id: 'europa', radiusKm: 1561, periodDays: 3.55, color: '#d9c8a8', name: { en: 'Europa', hi: 'यूरोपा' } },
      { id: 'ganymede', radiusKm: 2634, periodDays: 7.15, color: '#9c9184', name: { en: 'Ganymede', hi: 'गैनिमीड' } },
      { id: 'callisto', radiusKm: 2410, periodDays: 16.69, color: '#6e6457', name: { en: 'Callisto', hi: 'कैलिस्टो' } },
    ],
  },
  {
    id: 'saturn', radiusKm: 58232, au: 9.58, periodDays: 10759, dayHours: 10.66, tiltDeg: 26.7, texture: '2k_saturn.jpg', rings: '2k_saturn_ring_alpha.png',
    name: { en: 'Saturn', hi: 'शनि' },
    fact: { en: 'Saturn has beautiful rings, made of ice and rock.', hi: 'शनि के चारों ओर सुंदर छल्ले हैं, जो बर्फ़ और पत्थर से बने हैं।' },
    moons: [{ id: 'titan', radiusKm: 2575, periodDays: 15.95, color: '#d9a25a', name: { en: 'Titan', hi: 'टाइटन' } }],
  },
  {
    id: 'uranus', radiusKm: 25362, au: 19.2, periodDays: 30687, dayHours: -17.24, tiltDeg: 97.8, texture: '2k_uranus.jpg',
    name: { en: 'Uranus', hi: 'अरुण' },
    fact: { en: 'Uranus spins lying on its side, like a rolling ball.', hi: 'अरुण करवट लेकर घूमता है, लुढ़कती गेंद की तरह।' },
    moons: [],
  },
  {
    id: 'neptune', radiusKm: 24622, au: 30.1, periodDays: 60190, dayHours: 16.11, tiltDeg: 28.3, texture: '2k_neptune.jpg',
    name: { en: 'Neptune', hi: 'वरुण' },
    fact: { en: 'Neptune is the farthest planet. It is cold, blue and very windy.', hi: 'वरुण सबसे दूर का ग्रह है। यह ठंडा, नीला और बहुत हवादार है।' },
    moons: [],
  },
]);

export const UI_TEXT = Object.freeze({
  overview: { en: 'Our solar system', hi: 'हमारा सौर मंडल' },
  sizes: { en: 'Planet sizes compared', hi: 'ग्रहों का आकार' },
});
