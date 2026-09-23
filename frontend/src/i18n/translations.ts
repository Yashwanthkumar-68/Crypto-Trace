/**
 * Smart Multilingual Engine Translations
 * Languages supported:
 * - English (en)
 * - हिन्दी (hi) - Hindi
 * - தமிழ் (ta) - Tamil
 * - తెలుగు (te) - Telugu
 * - বাংলা (bn) - Bengali
 */

export type SupportedLanguage = 'en' | 'hi' | 'ta' | 'te' | 'bn';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  speechCode: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', speechCode: 'en-IN' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', speechCode: 'hi-IN' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', speechCode: 'ta-IN' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', speechCode: 'te-IN' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳', speechCode: 'bn-IN' }
];

export const translations: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    // Brand & Header
    'brand.title': 'CryptoTrace',
    'brand.badge': 'DEFENSE FORENSICS',
    'brand.subtitle': 'Real-Time VASP Identification & Money Trail Analytics',
    'nav.my_complaints': 'My Complaints',
    'nav.file_complaint': 'File New Complaint',
    'nav.verify_wallet': 'Verify Wallet',
    'nav.dashboard': 'Command Center',
    'nav.cases': 'Case Dossiers',
    'nav.batch': 'Batch Analytics',
    'nav.alerts': 'Priority Alerts',
    'nav.logout': 'Sign Out',
    'nav.role_victim': 'Citizen Victim',
    'nav.role_officer': 'Cyber Investigator',

    // Victim Dashboard
    'victim.portal_title': 'Citizen Victim Portal',
    'victim.interop_badge': 'NCRP / I4C Interoperable',
    'victim.welcome': 'Welcome',
    'victim.desc': 'Track real-time blockchain tracing progress, inspect exchange destination leads, and coordinate directly with your assigned Cybercrime Law Enforcement Officer.',
    'victim.stat_registered': 'Registered Complaints',
    'victim.stat_loss': 'Total Reported Loss',
    'victim.stat_active': 'Active Investigations',
    'victim.stat_resolved': 'Resolved & Recovered',
    'victim.search_placeholder': 'Search by case number or wallet...',
    'victim.showing_complaints': 'Showing registered complaints',
    'victim.file_first': 'File Your First Complaint',
    'victim.track_case': 'Track Case',
    'victim.ncrp_dossier': 'NCRP Dossier',

    // Case Journey Map Stages
    'journey.title': 'Forensic Case Journey',
    'journey.badge': 'AI-Agent Driven',
    'journey.step1': 'Complaint Filed',
    'journey.step2': 'Officer Assigned',
    'journey.step3': 'Under Investigation',
    'journey.step4': 'Funds Traced',
    'journey.step5': 'Report Filed',
    'journey.step6': 'Supervisor & VASP Review',
    'journey.step7': 'Case Resolved',

    // Pre-Transfer Wallet Verifier
    'verifier.title': 'Pre-Transfer Suspect Wallet Verifier',
    'verifier.tag': 'CITIZEN SCAM PRE-CHECK',
    'verifier.desc': 'Asked to transfer money or crypto by an investment advisor, online acquaintance, or task group? Verify whether the recipient wallet is already under investigation or reported in cyber complaints before losing your money.',
    'verifier.check_btn': 'Check Address',
    'verifier.checking': 'Analyzing On-Chain...',
    'verifier.helpline': 'National Cyber Helpline 1930',

    // Complaint Form
    'form.title': 'Register Cryptocurrency Fraud Incident',
    'form.mode_voice': 'Voice Assistant',
    'form.mode_manual': 'Manual Form',
    'form.victim_name': 'Complainant Full Name',
    'form.amount_lost': 'Amount Lost',
    'form.currency': 'Currency',
    'form.incident_date': 'Incident Date',
    'form.suspect_wallet': 'Suspect Wallet Address',
    'form.blockchain': 'Blockchain Network',
    'form.tx_hash': 'Transaction Hash (Optional)',
    'form.description': 'Incident Statement / Modus Operandi',
    'form.submit': 'Register Complaint & Notify Officer',
    'form.cancel': 'Cancel'
  },

  hi: {
    // Brand & Header
    'brand.title': 'CryptoTrace',
    'brand.badge': 'क्रिप्टो फॉरेंसिक्स',
    'brand.subtitle': 'रीयल-टाइम VASP पहचान एवं मनी ट्रेल एनालिटिक्स',
    'nav.my_complaints': 'मेरी शिकायतें',
    'nav.file_complaint': 'नई शिकायत दर्ज करें',
    'nav.verify_wallet': 'वॉलेट जांचें',
    'nav.dashboard': 'कमांड सेंटर',
    'nav.cases': 'केस फाइलें',
    'nav.batch': 'बैच विश्लेषण',
    'nav.alerts': 'प्राथमिकता अलर्ट',
    'nav.logout': 'लॉग आउट',
    'nav.role_victim': 'नागरिक पीड़ित',
    'nav.role_officer': 'साइबर जांच अधिकारी',

    // Victim Dashboard
    'victim.portal_title': 'नागरिक पीड़ित पोर्टल',
    'victim.interop_badge': 'NCRP / I4C प्रमाणित',
    'victim.welcome': 'स्वागत है',
    'victim.desc': 'रीयल-टाइम ब्लॉकचेन ट्रैकिंग प्रगति देखें, क्रिप्टो एक्सचेंज फ्रीज की स्थिति जांचें और अपने साइबर सेल जांच अधिकारी से समन्वय करें।',
    'victim.stat_registered': 'दर्ज शिकायतें',
    'victim.stat_loss': 'कुल नुकसान राशि',
    'victim.stat_active': 'सक्रिय जांच',
    'victim.stat_resolved': 'हल एवं रिकवर',
    'victim.search_placeholder': 'केस नंबर या वॉलेट से खोजें...',
    'victim.showing_complaints': 'दर्ज शिकायतें प्रदर्शित',
    'victim.file_first': 'अपनी पहली शिकायत दर्ज करें',
    'victim.track_case': 'केस ट्रैक करें',
    'victim.ncrp_dossier': 'NCRP डोजियर',

    // Case Journey Map Stages
    'journey.title': 'फॉरेंसिक केस प्रगति यात्रा',
    'journey.badge': 'AI-एजेंट संचालित',
    'journey.step1': 'शिकायत दर्ज',
    'journey.step2': 'अधिकारी नियुक्त',
    'journey.step3': 'जांच जारी',
    'journey.step4': 'फंड्स ट्रैक हुए',
    'journey.step5': 'रिपोर्ट व नोटिस तैयार',
    'journey.step6': 'एक्सचेंज समीक्षा',
    'journey.step7': 'केस का समाधान',

    // Pre-Transfer Wallet Verifier
    'verifier.title': 'ट्रांसफर-पूर्व संदिग्ध वॉलेट सत्यापन',
    'verifier.tag': 'नागरिक धोखाधड़ी सुरक्षा जांच',
    'verifier.desc': 'क्या किसी टेलीग्राम ग्रुप, ऑनलाइन दोस्त या टास्क स्कीम द्वारा क्रिप्टोकरंसी ट्रांसफर करने को कहा गया है? पैसे भेजने से पहले जांचें कि क्या वह वॉलेट किसी पुलिस शिकायत या जांच में दर्ज है।',
    'verifier.check_btn': 'वॉलेट जांचें',
    'verifier.checking': 'ब्लॉकचेन जांच जारी...',
    'verifier.helpline': 'राष्ट्रीय साइबर हेल्पलाइन 1930',

    // Complaint Form
    'form.title': 'क्रिप्टोकरंसी धोखाधड़ी शिकायत दर्ज करें',
    'form.mode_voice': 'वॉइस असिस्टेंट',
    'form.mode_manual': 'मैनुअल फॉर्म',
    'form.victim_name': 'शिकायतकर्ता का पूरा नाम',
    'form.amount_lost': 'नुकसान राशि',
    'form.currency': 'मुद्रा (करेंसी)',
    'form.incident_date': 'घटना की तारीख',
    'form.suspect_wallet': 'संदिग्ध का वॉलेट एड्रेस',
    'form.blockchain': 'ब्लॉकचेन नेटवर्क',
    'form.tx_hash': 'ट्रांजैक्शन हैश (वैकल्पिक)',
    'form.description': 'घटना का विवरण / बयान',
    'form.submit': 'शिकायत दर्ज करें एवं अधिकारी को सूचित करें',
    'form.cancel': 'रद्द करें'
  },

  ta: {
    // Brand & Header
    'brand.title': 'CryptoTrace',
    'brand.badge': 'சைபர் தடயவியல்',
    'brand.subtitle': 'நிகழ்நேர விஏஎஸ்பி அடையாளம் & பரிவர்த்தனை பகுப்பாய்வு',
    'nav.my_complaints': 'எனது புகார்கள்',
    'nav.file_complaint': 'புதிய புகார் பதிவு',
    'nav.verify_wallet': 'வாலட்டை சரிபார்க்கவும்',
    'nav.dashboard': 'கட்டுப்பாட்டு மையம்',
    'nav.cases': 'வழக்கு ஆவணங்கள்',
    'nav.batch': 'தொகுதி பகுப்பாய்வு',
    'nav.alerts': 'முன்னுரிமை எச்சரிக்கைகள்',
    'nav.logout': 'வெளியேறு',
    'nav.role_victim': 'பாதிக்கப்பட்ட குடிமகன்',
    'nav.role_officer': 'சைபர் புலனாய்வாளர்',

    // Victim Dashboard
    'victim.portal_title': 'குடிமக்கள் புகார் தளம்',
    'victim.interop_badge': 'NCRP / I4C ஒருங்கிணைப்பு',
    'victim.welcome': 'வணக்கம்',
    'victim.desc': 'நிகழ்நேர பிளாக்செயின் கண்காணிப்பு முன்னேற்றத்தைக் கண்காணிக்கவும், பரிவர்த்தனை தடயங்களை ஆய்வு செய்யவும்.',
    'victim.stat_registered': 'பதிவு செய்யப்பட்ட புகார்கள்',
    'victim.stat_loss': 'மொத்த இழப்பு தொகை',
    'victim.stat_active': 'நடப்பு விசாரணைகள்',
    'victim.stat_resolved': 'தீர்க்கப்பட்ட வழக்குகள்',
    'victim.search_placeholder': 'வழக்கு எண் அல்லது வாலட் மூலம் தேடவும்...',
    'victim.showing_complaints': 'பதிவு செய்யப்பட்ட புகார்கள்',
    'victim.file_first': 'முதல் புகாரை பதிவு செய்க',
    'victim.track_case': 'வழக்கை கண்காணிக்கவும்',
    'victim.ncrp_dossier': 'NCRP கோப்பு',

    // Case Journey Map Stages
    'journey.title': 'தடயவியல் வழக்கு பயணம்',
    'journey.badge': 'AI முகவர் இயக்கம்',
    'journey.step1': 'புகார் பதிவு செய்யப்பட்டது',
    'journey.step2': 'அதிகாரி நியமிக்கப்பட்டார்',
    'journey.step3': 'விசாரணை நடக்கிறது',
    'journey.step4': 'பணப்பரிமாற்றம் கண்டறியப்பட்டது',
    'journey.step5': 'அறிக்கை தாக்கல் செய்யப்பட்டது',
    'journey.step6': 'பரிவர்த்தனை ஆய்வு',
    'journey.step7': 'வழக்கு தீர்க்கப்பட்டது',

    // Pre-Transfer Wallet Verifier
    'verifier.title': 'பரிமாற்றத்திற்கு முன் சந்தேகத்திற்குரிய வாலட் சரிபார்ப்பு',
    'verifier.tag': 'மோசடி தடுப்பு சரிபார்ப்பு',
    'verifier.desc': 'டெலிகிராம் அல்லது சமூக ஊடகங்கள் மூலம் கிரிப்டோ அனுப்ப கோரப்பட்டதா? பணத்தை அனுப்பும் முன் சரிபார்க்கவும்.',
    'verifier.check_btn': 'சரிபார்க்கவும்',
    'verifier.checking': 'பகுப்பாய்வு செய்கிறது...',
    'verifier.helpline': 'தேசிய சைபர் உதவி எண் 1930',

    // Complaint Form
    'form.title': 'கிரிப்டோ மோசடி புகாரை பதிவு செய்க',
    'form.mode_voice': 'குரல் உதவியாளர்',
    'form.mode_manual': 'படிவம்',
    'form.victim_name': 'முழு பெயர்',
    'form.amount_lost': 'இழந்த தொகை',
    'form.currency': 'நாணயம்',
    'form.incident_date': 'நிகழ்வு தேதி',
    'form.suspect_wallet': 'சந்தேகத்திற்குரிய வாலட் முகவரி',
    'form.blockchain': 'பிளாக்செயின் நெட்வொர்க்',
    'form.tx_hash': 'பரிவர்த்தனை ஹேஷ் (விருப்பம்)',
    'form.description': 'சம்பவ விவரம்',
    'form.submit': 'புகாரை பதிவு செய்க',
    'form.cancel': 'ரத்து செய்க'
  },

  te: {
    // Brand & Header
    'brand.title': 'CryptoTrace',
    'brand.badge': 'డిఫెన్స్ ఫోరెన్సిక్స్',
    'brand.subtitle': 'రియల్-టైమ్ VASP గుర్తింపు & మనీ ట్రయల్ విశ్లేషణ',
    'nav.my_complaints': 'నా ఫిర్యాదులు',
    'nav.file_complaint': 'కొత్త ఫిర్యాదు చేయండి',
    'nav.verify_wallet': 'వాలెట్ తనిఖీ చేయండి',
    'nav.dashboard': 'కమాండ్ సెంటర్',
    'nav.cases': 'కేసుల వివరాలు',
    'nav.batch': 'బ్యాచ్ విశ్లేషణ',
    'nav.alerts': 'ముఖ్య హెచ్చరికలు',
    'nav.logout': 'లాగ్ అవుట్',
    'nav.role_victim': 'బాధిత పౌరుడు',
    'nav.role_officer': 'సైబర్ ఇన్వెస్టిగేటర్',

    // Victim Dashboard
    'victim.portal_title': 'పౌరుల పోర్టల్',
    'victim.interop_badge': 'NCRP / I4C అనుసంధానం',
    'victim.welcome': 'స్వాగతం',
    'victim.desc': 'రియల్-టైమ్ బ్లాక్‌చెయిన్ ట్రేసింగ్ పురోగతిని ట్రాక్ చేయండి మరియు మీ సైబర్ అధికారిని సంప్రదించండి.',
    'victim.stat_registered': 'నమోదైన ఫిర్యాదులు',
    'victim.stat_loss': 'మొత్తం పోగొట్టుకున్న సొమ్ము',
    'victim.stat_active': 'చేపట్టిన పరిశోధనలు',
    'victim.stat_resolved': 'పరిష్కరించబడినవి',
    'victim.search_placeholder': 'కేసు సంఖ్య లేదా వాలెట్ ద్వారా శోధించండి...',
    'victim.showing_complaints': 'నమోదైన ఫిర్యాదులు',
    'victim.file_first': 'మీ మొదటి ఫిర్యాదును నమోదు చేయండి',
    'victim.track_case': 'కేసు ట్రాక్ చేయండి',
    'victim.ncrp_dossier': 'NCRP నివేదిక',

    // Case Journey Map Stages
    'journey.title': 'ఫోరెన్సిక్ కేసు ప్రయాణం',
    'journey.badge': 'AI-ఏజెంట్ ఆధారితం',
    'journey.step1': 'ఫిర్యాదు దాఖలైంది',
    'journey.step2': 'అధికారి కేటాయింపు',
    'journey.step3': 'విచారణ జరుగుతోంది',
    'journey.step4': 'లావాదేవీలు గుర్తించబడ్డాయి',
    'journey.step5': 'నివేదిక సమర్పించబడింది',
    'journey.step6': 'ఎక్స్ఛేంజ్ సమీక్ష',
    'journey.step7': 'కేసు పరిష్కరించబడింది',

    // Pre-Transfer Wallet Verifier
    'verifier.title': 'బదిలీకి ముందు వాలెట్ తనిఖీ',
    'verifier.tag': 'మోస నివారణ తనిఖీ',
    'verifier.desc': 'క్రిప్టో పంపమని అడిగారా? డబ్బు పంపే ముందు ఆ వాలెట్ పై ఏవైనా ఫిర్యాదులు ఉన్నాయో లేదో తనిఖీ చేయండి.',
    'verifier.check_btn': 'వాలెట్ తనిఖీ చేయండి',
    'verifier.checking': 'విశ్లేషిస్తోంది...',
    'verifier.helpline': 'జాతీయ సైబర్ హెల్ప్‌లైన్ 1930',

    // Complaint Form
    'form.title': 'క్రిప్టో మోసంపై ఫిర్యాదు చేయండి',
    'form.mode_voice': 'వాయిస్ అసిస్టెంట్',
    'form.mode_manual': 'ఫారమ్',
    'form.victim_name': 'పూర్తి పేరు',
    'form.amount_lost': 'కోల్పోయిన మొత్తం',
    'form.currency': 'కరెన్సీ',
    'form.incident_date': 'సంఘటన తేదీ',
    'form.suspect_wallet': 'అనుమానిత వాలెట్ చిరునామా',
    'form.blockchain': 'బ్లాక్‌చెయిన్ నెట్‌వర్క్',
    'form.tx_hash': 'లావాదేవీ హాష్ (ఐచ్ఛికం)',
    'form.description': 'సమగ్ర వివరాలు',
    'form.submit': 'ఫిర్యాదు నమోదు చేయండి',
    'form.cancel': 'రద్దు చేయండి'
  },

  bn: {
    // Brand & Header
    'brand.title': 'CryptoTrace',
    'brand.badge': 'প্রতিরক্ষা ফরেনসিক',
    'brand.subtitle': 'রিয়েল-টাইম VASP সনাক্তকরণ ও মানি ট্রেইল বিশ্লেষণ',
    'nav.my_complaints': 'আমার অভিযোগ',
    'nav.file_complaint': 'নতুন অভিযোগ দায়ের করুন',
    'nav.verify_wallet': 'ওয়ালেট যাচাই করুন',
    'nav.dashboard': 'কমান্ড সেন্টার',
    'nav.cases': 'কেস ডসিয়ার',
    'nav.batch': 'ব্যাচ বিশ্লেষণ',
    'nav.alerts': 'জরুরী সতর্কতা',
    'nav.logout': 'লগ আউট',
    'nav.role_victim': 'নাগরিক ভিকটিম',
    'nav.role_officer': 'সাইবার তদন্তকারী',

    // Victim Dashboard
    'victim.portal_title': 'নাগরিক ভিকটিম পোর্টাল',
    'victim.interop_badge': 'NCRP / I4C সংহত',
    'victim.welcome': 'স্বাগতম',
    'victim.desc': 'রিয়েল-টাইম ব্লকচেইন ট্র্যাকিংয়ের অগ্রগতি ট্র্যাক করুন এবং আপনার নিযুক্ত সাইবার অফিসারের সাথে যোগাযোগ করুন।',
    'victim.stat_registered': 'নথিভুক্ত অভিযোগ',
    'victim.stat_loss': 'মোট ক্ষতির পরিমাণ',
    'victim.stat_active': 'চলমান তদন্ত',
    'victim.stat_resolved': 'মীমাংসা ও উদ্ধার',
    'victim.search_placeholder': 'কেস নম্বর বা ওয়ালেট দিয়ে অনুসন্ধান করুন...',
    'victim.showing_complaints': 'নথিভুক্ত অভিযোগ প্রদর্শিত',
    'victim.file_first': 'প্রথম অভিযোগ দায়ের করুন',
    'victim.track_case': 'কেস ট্র্যাক করুন',
    'victim.ncrp_dossier': 'NCRP ডসিয়ার',

    // Case Journey Map Stages
    'journey.title': 'ফরেনসিক কেস যাত্রা',
    'journey.badge': 'AI-এজেন্ট চালিত',
    'journey.step1': 'অভিযোগ দায়ের করা হয়েছে',
    'journey.step2': 'অফিসার নিযুক্ত',
    'journey.step3': 'তদন্তাধীন',
    'journey.step4': 'তহবিল চিহ্নিত করা হয়েছে',
    'journey.step5': 'রিপোর্ট দায়ের করা হয়েছে',
    'journey.step6': 'এক্সচেঞ্জ পর্যালোচনা',
    'journey.step7': 'মামলা নিষ্পত্তি',

    // Pre-Transfer Wallet Verifier
    'verifier.title': 'স্থানান্তরের পূর্বে ওয়ালেট যাচাইকরণ',
    'verifier.tag': 'প্রতারণা প্রতিরোধ চেক',
    'verifier.desc': 'টেলিগ্রাম বা সোশ্যাল মিডিয়ার মাধ্যমে ক্রিপ্টো পাঠাতে বলা হয়েছে? অর্থ পাঠানোর আগে যাচাই করুন।',
    'verifier.check_btn': 'যাচাই করুন',
    'verifier.checking': 'ব্লকচেইন বিশ্লেষণ চলছে...',
    'verifier.helpline': 'জাতীয় সাইবার হেল্পলাইন ১৯৩০',

    // Complaint Form
    'form.title': 'ক্রিপ্টো প্রতারণার অভিযোগ দায়ের করুন',
    'form.mode_voice': 'ভয়েস সহকারী',
    'form.mode_manual': 'ম্যানুয়াল ফর্ম',
    'form.victim_name': 'অভিযোগকারীর পুরো নাম',
    'form.amount_lost': 'ক্ষতির পরিমাণ',
    'form.currency': 'মুদ্রা',
    'form.incident_date': 'ঘটনার তারিখ',
    'form.suspect_wallet': 'সন্দেহভাজন ওয়ালেট ঠিকানা',
    'form.blockchain': 'ব্লকচেইন নেটওয়ার্ক',
    'form.tx_hash': 'লেনদেন হ্যাশ (ঐচ্ছিক)',
    'form.description': 'ঘটনার বিবরণ',
    'form.submit': 'অভিযোগ দায়ের করুন',
    'form.cancel': 'বাতিল করুন'
  }
};
