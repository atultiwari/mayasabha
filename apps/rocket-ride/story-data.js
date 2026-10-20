// "Rocket Ride to Chanda Mama": a bedtime trip through the solar system, in English and Hindi.
// {name} is the child (set on the stage with N, stored only in that browser); {pilot} is the
// co-pilot (the "pet" character slot: a puppy by default).
//
// Steps: say (narration), act (the child does something: clap, wave, pop, count), travel (to the
// next scene). Every act also has a phone "Help" button and moves on by itself after a while.

export const STORY = Object.freeze([
  {
    id: 'launch',
    steps: [
      { kind: 'say', text: { en: 'Hello {name}! Today we are flying to the Moon and the planets!', hi: 'नमस्ते {name}! आज हम चाँद और ग्रहों की सैर पर चलेंगे!' } },
      { kind: 'say', text: { en: '{pilot} is coming too! Everybody into the rocket.', hi: '{pilot} भी साथ चलेंगे! चलो, सब रॉकेट में बैठो।' } },
      { kind: 'act', action: 'clap', needed: 3, prompt: { en: 'Clap three times to count down!', hi: 'उल्टी गिनती के लिए तीन बार ताली बजाओ!' } },
      { kind: 'say', text: { en: 'Blast off!', hi: 'उड़ चले!' } },
      { kind: 'travel', seconds: 6 },
    ],
  },
  {
    id: 'moon',
    steps: [
      { kind: 'say', text: { en: 'We landed on the Moon, Chanda Mama!', hi: 'हम चंदा मामा पर पहुँच गए!' } },
      { kind: 'act', action: 'clap', needed: 3, prompt: { en: 'Clap to jump! On the Moon you can jump very high.', hi: 'ताली बजाओ और कूदो! चाँद पर हम बहुत ऊँचा कूद सकते हैं।' } },
      { kind: 'say', text: { en: 'Look, footprints! There is no wind on the Moon, so they stay for a very long time.', hi: 'देखो, पैरों के निशान! चाँद पर हवा नहीं चलती, इसलिए ये बहुत समय तक रहते हैं।' } },
      { kind: 'travel', seconds: 5 },
    ],
  },
  {
    id: 'mars',
    steps: [
      { kind: 'say', text: { en: 'This is Mars, the red planet.', hi: 'यह है मंगल, लाल ग्रह।' } },
      { kind: 'act', action: 'wave', needed: 1, prompt: { en: 'Oh no, a dust storm! Wave your hands to blow the dust away!', hi: 'अरे, धूल की आँधी! हाथ हिलाओ और धूल उड़ाओ!' } },
      { kind: 'say', text: { en: 'Hello, little robot! Mars is red because its dust is rusty.', hi: 'नमस्ते, छोटे रोबोट! मंगल की धूल में जंग है, इसलिए यह लाल है।' } },
      { kind: 'travel', seconds: 5 },
    ],
  },
  {
    id: 'jupiter',
    steps: [
      { kind: 'say', text: { en: 'Wow, Jupiter! The biggest planet of all.', hi: 'वाह, बृहस्पति! सबसे बड़ा ग्रह।' } },
      { kind: 'act', action: 'pop', needed: 5, prompt: { en: 'Pop the storm bubbles!', hi: 'तूफ़ान के बुलबुले फोड़ो!' } },
      { kind: 'say', text: { en: 'Jupiter is so big that all the other planets could fit inside it!', hi: 'बृहस्पति इतना बड़ा है कि बाकी सारे ग्रह इसके अंदर समा जाएँ!' } },
      { kind: 'travel', seconds: 5 },
    ],
  },
  {
    id: 'saturn',
    steps: [
      { kind: 'say', text: { en: 'Here comes Saturn with its beautiful rings! Wheee, let\'s slide!', hi: 'यह आया शनि, अपने सुंदर छल्लों के साथ! चलो फिसलें!' } },
      { kind: 'act', action: 'count', needed: 5, prompt: { en: 'Count the moons with me! Clap for each one.', hi: 'मेरे साथ चाँद गिनो! हर चाँद पर ताली बजाओ।' } },
      { kind: 'say', text: { en: 'We counted five! Saturn has lots and lots of moons. Its rings are made of ice and rock.', hi: 'हमने पाँच गिने! शनि के बहुत सारे चाँद हैं। इसके छल्ले बर्फ़ और पत्थर से बने हैं।' } },
      { kind: 'travel', seconds: 5 },
    ],
  },
  {
    id: 'sun',
    steps: [
      { kind: 'say', text: { en: 'The Sun! It is too hot. Sunglasses on!', hi: 'सूरज! बहुत गरमी है। धूप का चश्मा पहन लो!' } },
      { kind: 'act', action: 'wave', needed: 1, prompt: { en: 'Wave goodbye to the Sun!', hi: 'सूरज को टाटा करो!' } },
      { kind: 'say', text: { en: 'The Sun is a star. It keeps our Earth warm.', hi: 'सूरज एक तारा है। यह हमारी पृथ्वी को गरम रखता है।' } },
      { kind: 'travel', seconds: 6 },
    ],
  },
  {
    id: 'home',
    steps: [
      { kind: 'say', text: { en: 'We are back home on Earth!', hi: 'हम घर वापस आ गए, पृथ्वी पर!' } },
      { kind: 'say', text: { en: 'Goodnight Moon. Goodnight Mars. Goodnight Jupiter. Goodnight Saturn.', hi: 'शुभ रात्रि चंदा मामा। शुभ रात्रि मंगल। शुभ रात्रि बृहस्पति। शुभ रात्रि शनि।' } },
      { kind: 'say', text: { en: 'Goodnight, {name}. Sweet dreams!', hi: 'शुभ रात्रि, {name}। मीठे सपने!' } },
      { kind: 'end', seconds: 20 },
    ],
  },
]);

export const PRAISE = Object.freeze([
  { en: 'Well done!', hi: 'शाबाश!' },
  { en: 'Super!', hi: 'बहुत बढ़िया!' },
  { en: 'Yay, you did it!', hi: 'वाह, तुमने कर दिखाया!' },
]);

export const DEFAULTS = Object.freeze({
  name: { en: 'little astronaut', hi: 'नन्हे अंतरिक्ष यात्री' },
});

export const NUMBERS = Object.freeze({
  en: ['one', 'two', 'three', 'four', 'five'],
  hi: ['एक', 'दो', 'तीन', 'चार', 'पाँच'],
});
