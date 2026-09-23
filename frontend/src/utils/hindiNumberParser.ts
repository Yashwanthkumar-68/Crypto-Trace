/**
 * Hindi & Hinglish Number & Currency Parser
 * Converts spoken Hindi, Hinglish, and English vernacular into numeric values.
 * e.g. "पांच लाख" -> 500000, "दो करोड़ पचास हजार" -> 20050000, "5 लाख" -> 500000
 */

const HINDI_DIGITS: { [key: string]: number } = {
  'शून्य': 0, 'zero': 0,
  'एक': 1, 'ek': 1, 'one': 1,
  'दो': 2, 'do': 2, 'two': 2,
  'तीन': 3, 'teen': 3, 'three': 3,
  'चार': 4, 'char': 4, 'four': 4,
  'पांच': 5, 'paanch': 5, 'panch': 5, 'five': 5,
  'छह': 6, 'che': 6, 'chhah': 6, 'six': 6,
  'सात': 7, 'saat': 7, 'seven': 7,
  'आठ': 8, 'aath': 8, 'eight': 8,
  'नौ': 9, 'nau': 9, 'nine': 9,
  'दस': 10, 'das': 10, 'ten': 10,
  'ग्यारह': 11, 'gyarah': 11, 'eleven': 11,
  'बारह': 12, 'barah': 12, 'twelve': 12,
  'तेरह': 13, 'terah': 13, 'thirteen': 13,
  'चौदह': 14, 'chaudah': 14, 'fourteen': 14,
  'पंद्रह': 15, 'pandrah': 15, 'fifteen': 15,
  'सोलह': 16, 'solah': 16, 'sixteen': 16,
  'सत्रह': 17, 'satrah': 17, 'seventeen': 17,
  'अठारह': 18, 'atharah': 18, 'eighteen': 18,
  'उन्नीस': 19, 'unnees': 19, 'nineteen': 19,
  'बीस': 20, 'bees': 20, 'twenty': 20,
  'पच्चीस': 25, 'pachchis': 25, 'twenty five': 25,
  'तीस': 30, 'tees': 30, 'thirty': 30,
  'पैंतीस': 35, 'paintis': 35,
  'चालीस': 40, 'chalis': 40, 'forty': 40,
  'पचास': 50, 'pachas': 50, 'fifty': 50,
  'साठ': 60, 'saath': 60, 'sixty': 60,
  'सत्तर': 70, 'sattar': 70, 'seventy': 70,
  'अस्सी': 80, 'assi': 80, 'eighty': 80,
  'नब्बे': 90, 'nabbe': 90, 'ninety': 90
};

const MULTIPLIERS: { [key: string]: number } = {
  'सौ': 100, 'sau': 100, 'hundred': 100,
  'हजार': 1000, 'hazar': 1000, 'hazár': 1000, 'thousand': 1000, 'k': 1000,
  'लाख': 100000, 'lakh': 100000, 'lac': 100000, 'lacs': 100000, 'lakhs': 100000,
  'करोड़': 10000000, 'karod': 10000000, 'crore': 10000000, 'crores': 10000000, 'cr': 10000000
};

/**
 * Extracts and calculates raw integer value from spoken text containing numbers
 */
export function parseSpokenAmount(text: string): { amount: number | null; rawMatched: string } {
  if (!text) return { amount: null, rawMatched: '' };

  const cleaned = text.toLowerCase().replace(/,/g, '').trim();

  // 1. Direct digit check with suffix (e.g. "500000", "5 lakh", "2.5 crore")
  const digitMultiplierMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(लाख|करोड़|हजार|sau|lakh|lakhs|lac|crore|crores|cr|k|thousand)/i);
  if (digitMultiplierMatch) {
    const num = parseFloat(digitMultiplierMatch[1]);
    const multWord = digitMultiplierMatch[2].toLowerCase();
    const mult = MULTIPLIERS[multWord] || 1;
    return { amount: Math.round(num * mult), rawMatched: digitMultiplierMatch[0] };
  }

  // 2. Direct plain digits (e.g. "50000", "₹120000")
  const plainDigitMatch = cleaned.match(/₹?\s*(\d{2,12})/);
  if (plainDigitMatch) {
    return { amount: parseInt(plainDigitMatch[1], 10), rawMatched: plainDigitMatch[0] };
  }

  // 3. Spoken Hindi phrase evaluation (e.g. "पांच लाख पचास हजार")
  const words = cleaned.split(/\s+/);
  let total = 0;
  let current = 0;
  let matchedWords: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/[^\w\u0900-\u097F]/g, '');
    if (!w) continue;

    if (HINDI_DIGITS[w] !== undefined) {
      current += HINDI_DIGITS[w];
      matchedWords.push(w);
    } else if (MULTIPLIERS[w] !== undefined) {
      const mult = MULTIPLIERS[w];
      current = (current === 0 ? 1 : current) * mult;
      total += current;
      current = 0;
      matchedWords.push(w);
    }
  }

  total += current;

  if (total > 0) {
    return { amount: total, rawMatched: matchedWords.join(' ') };
  }

  return { amount: null, rawMatched: '' };
}

/**
 * Extracts suspect crypto wallet address from spoken or typed input
 */
export function extractWalletAddress(text: string): string | null {
  if (!text) return null;
  // EVM (Ethereum / Polygon / BSC)
  const evmMatch = text.match(/0x[a-fA-F0-9]{40}/);
  if (evmMatch) return evmMatch[0];

  // Bitcoin (Legacy / SegWit / Bech32)
  const btcMatch = text.match(/(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}/);
  if (btcMatch) return btcMatch[0];

  // TRON (Base58 starting with T)
  const tronMatch = text.match(/T[A-Za-z1-9]{33}/);
  if (tronMatch) return tronMatch[0];

  // Solana
  const solMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (solMatch && solMatch[0].length >= 32 && !solMatch[0].startsWith('0x')) {
    return solMatch[0];
  }

  return null;
}

/**
 * Extracts transaction hash from spoken or typed input
 */
export function extractTransactionHash(text: string): string | null {
  if (!text) return null;
  const hashMatch = text.match(/0x[a-fA-F0-9]{64}/);
  if (hashMatch) return hashMatch[0];
  return null;
}
