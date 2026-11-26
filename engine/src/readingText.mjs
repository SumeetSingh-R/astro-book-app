// A plain-words chart reading built from fixed lines, used when the AI model is not available.
// It says less than the AI-written reading, but every sentence comes straight from the chart.

const LAGNA_LINES = [
  'With Mesha (Aries) rising, you tend to meet life head-on: quick to start, direct, and happiest when you are leading the way.',
  'With Vrishabha (Taurus) rising, you tend to be steady and patient, fond of comfort, and hard to push once your mind is made up.',
  'With Mithuna (Gemini) rising, you tend to be curious and quick with words, at ease juggling several interests at once.',
  'With Karka (Cancer) rising, you tend to be caring and protective, guided by feeling, and closely tied to home and family.',
  'With Simha (Leo) rising, you tend to be warm and proud, with a natural wish to be seen, to lead and to be generous.',
  'With Kanya (Virgo) rising, you tend to be practical and observant, with an eye for detail and a wish to be useful.',
  'With Tula (Libra) rising, you tend to be gracious and fair-minded, drawn to partnership and to keeping things in balance.',
  'With Vrishchika (Scorpio) rising, you tend to be intense and private, determined, and unwilling to do things by halves.',
  'With Dhanu (Sagittarius) rising, you tend to be optimistic and frank, drawn to learning, travel and the bigger picture.',
  'With Makara (Capricorn) rising, you tend to be disciplined and responsible, willing to work long and patiently for a goal.',
  'With Kumbha (Aquarius) rising, you tend to be independent and thoughtful, with your own way of seeing things and a care for the wider group.',
  'With Meena (Pisces) rising, you tend to be gentle and imaginative, sensitive to others and drawn to the inner life.',
];

const MOON_LINES = [
  'Your Moon in Mesha gives quick, strong feelings and a need for action and independence.',
  'Your Moon in Vrishabha gives a calm, steady mind that needs security, good food and familiar comforts.',
  'Your Moon in Mithuna gives a lively, restless mind that needs conversation and variety.',
  'Your Moon in Karka gives deep feelings, a strong memory and a need to care and be cared for.',
  'Your Moon in Simha gives a warm heart, pride, and a need for appreciation.',
  'Your Moon in Kanya gives a careful, analytical mind that settles when things are in order.',
  'Your Moon in Tula gives a sociable mind that needs harmony and company.',
  'Your Moon in Vrishchika gives strong, private emotions and a need for trust and depth.',
  'Your Moon in Dhanu gives an upbeat, freedom-loving mind that needs meaning and room to roam.',
  'Your Moon in Makara gives a serious, self-controlled mind that needs purpose and achievement.',
  'Your Moon in Kumbha gives a cool, independent mind that needs space, ideas and friendship.',
  'Your Moon in Meena gives a tender, intuitive mind that needs quiet and time to dream.',
];

const DASHA_LINES = {
  Sun: 'The Sun\'s period puts the spotlight on identity, confidence, authority and your standing with seniors and father figures.',
  Moon: 'The Moon\'s period turns attention to feelings, home, mother, the public and changes of place or routine.',
  Mars: 'The period of Mars brings energy, initiative and competition, and rewards courage used with a cool head.',
  Rahu: 'Rahu\'s period brings ambition, new and unfamiliar ground, and a pull towards things outside your usual world.',
  Jupiter: 'Jupiter\'s period favours growth, learning, guidance, family and a widening of opportunity.',
  Saturn: 'Saturn\'s period asks for patience, discipline and hard, steady work, and builds things that last.',
  Mercury: 'Mercury\'s period favours study, communication, trade and anything that needs a quick, adaptable mind.',
  Ketu: 'Ketu\'s period turns you inward: letting go, simplifying, and a search for what truly matters.',
  Venus: 'The period of Venus favours relationships, comfort, the arts and the enjoyment of what you have built.',
};

const AREAS = [
  { key: 'career', house: 10, name: 'career' },
  { key: 'money', house: 2, name: 'money' },
  { key: 'relationships', house: 7, name: 'marriage and partnership' },
  { key: 'family', house: 4, name: 'home and family' },
];

const monthYear = (iso) => new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** @param {object} facts from chartFacts() */
export function ruleChartReading(facts) {
  const moonLine = MOON_LINES[facts.planets.find((p) => p.name === 'Moon').rashiIndex - 1];
  const lagnaLine = facts.lagna ? LAGNA_LINES[facts.houses[0].rashiIndex - 1] : null;
  const d = facts.dasha.now;
  const nowLine = d
    ? `You are in the ${d.maha} mahadasha (a major period of life) until ${monthYear(d.mahaEnd)}, with the ${d.antar} sub-period running until ${monthYear(d.antarEnd)}. ${DASHA_LINES[d.maha]}`
    : null;

  const summary = facts.lagna
    ? `Your rising sign (lagna) is ${facts.lagna.rashi}, your Moon sign is ${facts.moon.rashi} and your birth star is ${facts.moon.nakshatra}. Each note below says what one part of the chart shows and where it comes from.`
    : `Your Moon sign is ${facts.moon.rashi} and your birth star is ${facts.moon.nakshatra}. Without a birth time there is no rising sign, so the notes below are read from the Moon and are less precise.`;
  const basis = facts.houseBasis === 'lagna' ? 'the lagna' : 'your Moon sign, because the birth time is unknown';

  const areas = [
    {
      key: 'nature',
      text: [lagnaLine, moonLine].filter(Boolean).join(' '),
      why: facts.lagna
        ? `Lagna (rising sign) ${facts.lagna.rashi}; Moon in ${facts.moon.rashi}, ${facts.moon.nakshatra} nakshatra.`
        : `Moon in ${facts.moon.rashi}, ${facts.moon.nakshatra} nakshatra. The rising sign needs a birth time.`,
    },
    ...AREAS.map((a) => {
      const h = facts.houses[a.house - 1];
      const target = facts.houses[h.lordInHouse - 1];
      const strength = h.lordDignity === 'exalted' || h.lordDignity === 'own sign'
        ? `${h.lord} is strong there (${h.lordDignity}), which supports this side of life.`
        : h.lordDignity === 'debilitated'
          ? `${h.lord} is weak there (debilitated), so this side of life asks for more patience and effort.`
          : '';
      const occupants = h.occupants.length
        ? `${h.occupants.join(', ')} ${h.occupants.length > 1 ? 'sit' : 'sits'} in this house and ${h.occupants.length > 1 ? 'colour' : 'colours'} it directly.`
        : '';
      return {
        key: a.key,
        text: [
          `Your house of ${a.name} is ${h.rashi}, ruled by ${h.lord}. ${h.lord} sits in your house of ${target.topics}, so ${a.name} is tied to those themes in your life.`,
          strength, occupants,
        ].filter(Boolean).join(' '),
        why: `House ${a.house} counted from ${basis}: ${h.rashi}, lord ${h.lord} in house ${h.lordInHouse}${h.occupants.length ? `; occupied by ${h.occupants.join(', ')}` : ''}.`,
      };
    }),
    ...(nowLine ? [{ key: 'now', text: nowLine, why: `Vimshottari dasha counted from the Moon's nakshatra at birth (${facts.moon.nakshatra}).` }] : []),
  ];
  return { summary, areas };
}
