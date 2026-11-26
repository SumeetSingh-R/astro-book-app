import { createContext, useContext, useState } from 'react';

// The language readings and answers are written in. Page furniture stays in English for now;
// the labels directly around a reading follow this choice.
const LanguageContext = createContext(['en', () => {}]);
export const useLanguage = () => useContext(LanguageContext);

function stored() {
  try { return localStorage.getItem('reading.language') === 'hi' ? 'hi' : 'en'; } catch { return 'en'; }
}

export function LanguageProvider({ children }) {
  const [language, setState] = useState(stored);
  const setLanguage = (value) => {
    setState(value);
    try { localStorage.setItem('reading.language', value); } catch { /* storage unavailable */ }
  };
  return <LanguageContext.Provider value={[language, setLanguage]}>{children}</LanguageContext.Provider>;
}

export function LanguageSwitch() {
  const [language, setLanguage] = useLanguage();
  return (
    <div className="segmented compact language" role="group" aria-label="Language for readings and answers">
      {[['en', 'English'], ['hi', 'हिन्दी']].map(([key, name]) => (
        <button key={key} type="button" lang={key} aria-pressed={language === key} className={language === key ? 'on' : undefined} onClick={() => setLanguage(key)}>{name}</button>
      ))}
    </div>
  );
}

const WORDS = {
  en: {
    plainWords: 'In plain words',
    why: 'Why we say this',
    nature: 'Your nature', career: 'Work and career', money: 'Money', relationships: 'Marriage and partnership',
    family: 'Home and family', wellbeing: 'Energy and wellbeing', now: 'The period you are in',
    writing: 'Writing the reading for this chart…',
    shortReading: 'A shorter reading is shown because the full one could not be written just now.',
    hindiUnavailable: 'The Hindi reading is not available just now, so this one is in English.',
    askTitle: 'Ask about this chart',
    askIntro: 'Ask in your own words. The answer is written from this chart, not from a sign.',
    askPlaceholder: 'When is a good period for…',
    ask: 'Ask', asking: 'Reading the chart…',
    basedOn: 'Based on',
    left: (n, limit) => `${n} of ${limit} questions left today.`,
    privacy: 'Your question, your age and this chart\'s planet positions go to an AI model (Claude) to write the answer. Your name, email, birth date and birth place are not sent. Answers are for reflection, not certainties.',
    clear: 'Clear this conversation', clearConfirm: 'Delete every question and answer here?', clearYes: 'Delete them', clearNo: 'Keep them',
    suggestions: ['When is a good period for marriage?', 'What kind of work suits me?', 'How do the next two years look for money?', 'What is my current period about?'],
    goodFor: 'Good for', takeCare: 'Go gently with',
    whyToday: 'Why today reads this way',
    tone: { supportive: 'A supportive day', steady: 'A steady day', demanding: 'A demanding day' },
    askToday: 'Ask about your day or your chart',
  },
  hi: {
    plainWords: 'सरल शब्दों में',
    why: 'ऐसा क्यों',
    nature: 'आपका स्वभाव', career: 'काम और करियर', money: 'धन', relationships: 'विवाह और साझेदारी',
    family: 'घर और परिवार', wellbeing: 'ऊर्जा और सेहत', now: 'आपका वर्तमान समय',
    writing: 'इस कुंडली का फल लिखा जा रहा है…',
    shortReading: 'पूरा फल अभी नहीं लिखा जा सका, इसलिए छोटा फल दिखाया गया है।',
    hindiUnavailable: 'हिन्दी में फल अभी उपलब्ध नहीं है, इसलिए यह अंग्रेज़ी में है।',
    askTitle: 'इस कुंडली से पूछें',
    askIntro: 'अपने शब्दों में पूछें। उत्तर इसी कुंडली से लिखा जाता है, केवल राशि से नहीं।',
    askPlaceholder: 'मेरे लिए अच्छा समय कब है…',
    ask: 'पूछें', asking: 'कुंडली पढ़ी जा रही है…',
    basedOn: 'आधार',
    left: (n, limit) => `आज के ${limit} में से ${n} प्रश्न बाक़ी हैं।`,
    privacy: 'उत्तर लिखने के लिए आपका प्रश्न, आपकी आयु और इस कुंडली की ग्रह-स्थिति एक AI मॉडल (Claude) को भेजी जाती है। आपका नाम, ईमेल, जन्म तिथि और जन्म स्थान नहीं भेजे जाते। उत्तर मार्गदर्शन के लिए हैं, निश्चित भविष्यवाणी नहीं।',
    clear: 'यह बातचीत मिटाएँ', clearConfirm: 'यहाँ के सभी प्रश्न और उत्तर मिटा दें?', clearYes: 'मिटा दें', clearNo: 'रहने दें',
    suggestions: ['विवाह के लिए अच्छा समय कब है?', 'मेरे लिए कौन सा काम ठीक रहेगा?', 'अगले दो साल धन के लिए कैसे हैं?', 'मेरी वर्तमान दशा क्या कहती है?'],
    goodFor: 'आज के लिए अच्छा', takeCare: 'इसमें संभलकर',
    whyToday: 'आज का फल ऐसा क्यों है',
    tone: { supportive: 'सहायक दिन', steady: 'सामान्य दिन', demanding: 'मेहनत वाला दिन' },
    askToday: 'अपने दिन या कुंडली के बारे में पूछें',
  },
};

/** Words for the labels around a reading, in the reading's language. */
export const wordsFor = (language) => WORDS[language] ?? WORDS.en;
