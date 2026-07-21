/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OdiaQuote {
  id: number;
  odia: string;
  english: string;
  meaning: string;
}

export const ODIA_QUOTES: OdiaQuote[] = [
  {
    id: 1,
    odia: "ଆପଣା ହାତ ଜଗନ୍ନାଥ ।",
    english: "Apana Hata Jagannatha.",
    meaning: "Your own hand is your savior. It teaches the power of self-reliance and taking charge of your own path."
  },
  {
    id: 2,
    odia: "ଧୈର୍ଯ୍ୟ ରଖିଲେ ସବୁ କାର୍ଯ୍ୟ ସଫଳ ହୁଏ ।",
    english: "Dhairya rakhile sabu karjya saphala hue.",
    meaning: "With patience and steady determination, every endeavor succeeds. Good things take time."
  },
  {
    id: 3,
    odia: "କର୍ମ ହିଁ ଭଗବାନ ।",
    english: "Karma hi Bhagabana.",
    meaning: "Work is worship. Dedicating yourself fully to your duty is the highest form of devotion."
  },
  {
    id: 4,
    odia: "ସନ୍ତୋଷ ହିଁ ପରମ ସୁଖ ।",
    english: "Santosa hi parama sukha.",
    meaning: "Contentment is the greatest wealth and the key to true, everlasting peace of mind."
  },
  {
    id: 5,
    odia: "ଚେଷ୍ଟା କଲେ ସବୁ ସମ୍ଭବ ।",
    english: "Chesta kale sabu sambhaba.",
    meaning: "With sincere effort, everything is possible. No mountain is too high for a determined heart."
  },
  {
    id: 6,
    odia: "ବିଦ୍ୟା ମହା ଧନ ।",
    english: "Bidya maha dhana.",
    meaning: "Knowledge is the greatest wealth. It can neither be stolen nor depleted, only multiplied as you share it."
  }
];

export interface MoodOption {
  id: string;
  emoji: string;
  nameOdia: string;
  nameEng: string;
  color: string;
  colorBg: string;
  messageOdia: string;
  messageEng: string;
  activityOdia: string;
  activityEng: string;
}

export const MOOD_OPTIONS: MoodOption[] = [
  {
    id: "happy",
    emoji: "😊",
    nameOdia: "ଆନନ୍ଦିତ (Happy)",
    nameEng: "Joyful",
    color: "text-amber-600 border-amber-500",
    colorBg: "bg-amber-50/50",
    messageOdia: "ଆପଣଙ୍କର ଏହି ପ୍ରସନ୍ନତା ସମସ୍ତଙ୍କ ମୁହଁରେ ହସ ଆଣିଦେଉ! ଆଜିର ଦିନଟିକୁ ପୂର୍ଣ୍ଣ ଆନନ୍ଦରେ ଉପଭୋଗ କରନ୍ତୁ।",
    messageEng: "Let your happiness brighten everyone's world! Enjoy every single moment of this beautiful day.",
    activityOdia: "ଆଜି କୌଣସି ପ୍ରିୟ ବନ୍ଧୁଙ୍କ ସହ କଥା ହୁଅନ୍ତୁ କିମ୍ବା ଏକ ସୁନ୍ଦର ଓଡ଼ିଆ ଗୀତ ଶୁଣନ୍ତୁ।",
    activityEng: "Call a close friend or play a beautiful, calming melody to celebrate your great mood."
  },
  {
    id: "calm",
    emoji: "😌",
    nameOdia: "ଶାନ୍ତ (Calm)",
    nameEng: "Peaceful",
    color: "text-emerald-600 border-emerald-500",
    colorBg: "bg-emerald-50/50",
    messageOdia: "ଶାନ୍ତି ହେଉଛି ଆତ୍ମାର ସବୁଠାରୁ ବଡ଼ ସୌନ୍ଦର୍ଯ୍ୟ। ଆପଣଙ୍କର ଏହି ପ୍ରଶାନ୍ତ ମନ ଆପଣଙ୍କୁ ନୂଆ ଶକ୍ତି ଦେବ।",
    messageEng: "Peace is the beauty of the soul. Your calm presence is a source of clarity and strength.",
    activityOdia: "୧ ମିନିଟ୍ ପାଇଁ ଆଖି ବନ୍ଦ କରି ଧୀରେ ଧୀରେ ଦୀର୍ଘଶ୍ୱାସ ନିଅନ୍ତୁ।",
    activityEng: "Take a 1-minute pause: close your eyes and breathe slowly to feel beautifully centered."
  },
  {
    id: "tired",
    emoji: "😴",
    nameOdia: "କ୍ଲାନ୍ତ (Tired)",
    nameEng: "Exhausted",
    color: "text-blue-600 border-blue-500",
    colorBg: "bg-blue-50/50",
    messageOdia: "ବେଳେବେଳେ ବିଶ୍ରାମ ନେବା ମଧ୍ୟ ଏକ ପ୍ରଗତି। ନିଜକୁ ଟିକିଏ ସମୟ ଦିଅନ୍ତୁ, ଶରୀର ଓ ମନକୁ ଆରାମ ଦିଅନ୍ତୁ।",
    messageEng: "Resting is also progress. Give yourself permission to pause, recharge, and relax.",
    activityOdia: "ଉଷୁମ ପାଣି ପିଅନ୍ତୁ, ସ୍କ୍ରିନ୍‌ଠାରୁ ଦୂରେଇ ରୁହନ୍ତୁ ଏବଂ କିଛି ସମୟ ବିଶ୍ରାମ କରନ୍ତୁ।",
    activityEng: "Hydrate yourself, step away from screens for a while, and let your body recover peacefully."
  },
  {
    id: "anxious",
    emoji: "🧠",
    nameOdia: "ଚିନ୍ତିତ (Anxious)",
    nameEng: "Overwhelmed",
    color: "text-rose-600 border-rose-500",
    colorBg: "bg-rose-50/50",
    messageOdia: "ସବୁ ସମସ୍ୟାର ସମାଧାନ ସମୟ ସହ ଆସିଯାଏ। ବ୍ୟସ୍ତ ହୁଅନ୍ତୁ ନାହିଁ, ଆପଣ ସବୁକିଛି ପରିଚାଳନା କରିପାରିବେ।",
    messageEng: "Every challenge resolves with time. Take things one breath at a time; you are stronger than you think.",
    activityOdia: "ଏକ କାଗଜରେ ଆପଣଙ୍କର ସମସ୍ତ ଚିନ୍ତା ଲେଖି ଦିଅନ୍ତୁ ଏବଂ ମନକୁ ହାଲୁକା କରନ୍ତୁ।",
    activityEng: "Do a quick brain-dump: write down your thoughts on a paper to immediately clear your mind."
  }
];

export const ODIA_MONTHS: Record<number, string> = {
  0: "ଜାନୁଆରୀ (January)",
  1: "ଫେବୃଆରୀ (February)",
  2: "ମାର୍ଚ୍ଚ (March)",
  3: "ଏପ୍ରିଲ୍ (April)",
  4: "ମେ (May)",
  5: "ଜୁନ୍ (June)",
  6: "ଜୁଲାଇ (July)",
  7: "ଅଗଷ୍ଟ (August)",
  8: "ସେପ୍ଟେମ୍ବର (September)",
  9: "ଅକ୍ଟୋବର (October)",
  10: "ନଭେମ୍ବର (November)",
  11: "ଡିସେମ୍ବର (December)",
};

export const ODIA_DAYS: Record<number, string> = {
  0: "ରବିବାର (Sunday)",
  1: "ସୋମବାର (Monday)",
  2: "ମଙ୍ଗଳବାର (Tuesday)",
  3: "ବୁଧବାର (Wednesday)",
  4: "ଗୁରୁବାର (Thursday)",
  5: "ଶୁକ୍ରବାର (Friday)",
  6: "ଶନିବାର (Saturday)",
};

export const toOdiaDigits = (numStr: string | number): string => {
  const odiaDigits = ["୦", "୧", "୨", "୩", "୪", "୫", "୬", "୭", "୮", "୯"];
  return numStr
    .toString()
    .replace(/[0-9]/g, (match) => odiaDigits[parseInt(match, 10)]);
};
