// School-Safe Profanity Blocklist & Frosted Blur Pill Engine

// Comprehensive list of words filtered in school/educational settings
const PROFANITY_WORDS = [
  'damn',
  'hell',
  'crap',
  'ass',
  'asshole',
  'bitch',
  'bastard',
  'shit',
  'bullshit',
  'fuck',
  'fucking',
  'motherfucker',
  'dick',
  'cock',
  'pussy',
  'fag',
  'faggot',
  'nigger',
  'nigga',
  'retard',
  'slut',
  'whore',
  'dumbass',
  'jackass',
];

// Regex matching whole profanity words with boundary and common l33tspeak variations
const PROFANITY_REGEX = new RegExp(
  `\\b(${PROFANITY_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'gi'
);

export interface TextToken {
  type: 'text' | 'profanity' | 'emoji';
  content: string;
  originalWord?: string;
  tokenIndex: number;
}

// Emoji shortcode map
export const CUSTOM_EMOJIS: Record<string, string> = {
  ':rocket:': '🚀',
  ':fire:': '🔥',
  ':books:': '📚',
  ':star:': '⭐',
  ':trophy:': '🏆',
  ':pencil:': '✏️',
  ':brain:': '🧠',
  ':microscope:': '🔬',
  ':bulb:': '💡',
  ':dna:': '🧬',
  ':robot:': '🤖',
  ':calculator:': '📐',
  ':check:': '✅',
  ':heart:': '❤️',
  ':wave:': '👋',
  ':warning:': '⚠️',
  ':shield:': '🛡️',
  ':sparkles:': '✨',
  ':smile:': '😊',
  ':party:': '🎉',
};

export function parseShortcodes(text: string): string {
  let result = text;
  for (const [code, emoji] of Object.entries(CUSTOM_EMOJIS)) {
    result = result.replaceAll(code, emoji);
  }
  return result;
}

export function tokenizeMessageContent(
  text: string,
  blurProfanity: boolean,
  revealedIndices: Set<string | number>,
  messageId?: string
): TextToken[] {
  if (!text) return [];

  // First convert custom emoji shortcodes
  const expandedText = parseShortcodes(text);

  if (!blurProfanity) {
    return [
      {
        type: 'text',
        content: expandedText,
        tokenIndex: 0,
      },
    ];
  }

  const tokens: TextToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokenCounter = 0;

  // Reset regex state
  PROFANITY_REGEX.lastIndex = 0;

  while ((match = PROFANITY_REGEX.exec(expandedText)) !== null) {
    const matchIndex = match.index;
    const matchWord = match[0];

    // Push preceding normal text if any
    if (matchIndex > lastIndex) {
      tokens.push({
        type: 'text',
        content: expandedText.substring(lastIndex, matchIndex),
        tokenIndex: tokenCounter++,
      });
    }

    const currentTokenId = tokenCounter++;
    const tokenKey = messageId ? `${messageId}-tok-${currentTokenId}` : currentTokenId;
    const isRevealed =
      revealedIndices.has(tokenKey as string) || revealedIndices.has(currentTokenId);

    tokens.push({
      type: 'profanity',
      content: isRevealed ? matchWord : '████',
      originalWord: matchWord,
      tokenIndex: currentTokenId,
    });

    lastIndex = matchIndex + matchWord.length;
  }

  // Push remaining text
  if (lastIndex < expandedText.length) {
    tokens.push({
      type: 'text',
      content: expandedText.substring(lastIndex),
      tokenIndex: tokenCounter++,
    });
  }

  return tokens;
}

export function containsProfanity(text: string): boolean {
  PROFANITY_REGEX.lastIndex = 0;
  return PROFANITY_REGEX.test(text);
}
