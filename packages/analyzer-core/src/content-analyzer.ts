import * as cheerio from 'cheerio';

/**
 * Content analysis results
 */
export interface ContentAnalysis {
  // Readability metrics
  readability: {
    score: number; // 0-100 (Flesch Reading Ease)
    grade: string; // Reading grade level
    rating: 'very-easy' | 'easy' | 'fairly-easy' | 'standard' | 'fairly-difficult' | 'difficult' | 'very-difficult';
  };
  
  // Word statistics
  words: {
    total: number;
    unique: number;
    averageLength: number;
  };
  
  // Sentence statistics
  sentences: {
    total: number;
    averageWordsPerSentence: number;
    averageSyllablesPerWord: number;
  };
  
  // Keyword analysis
  keywords: Array<{
    word: string;
    count: number;
    density: number; // percentage
  }>;
  
  // Content structure
  structure: {
    headings: {
      h1: number;
      h2: number;
      h3: number;
      h4: number;
      h5: number;
      h6: number;
    };
    paragraphs: number;
    lists: number;
    images: number;
    links: {
      internal: number;
      external: number;
    };
  };
}

/**
 * Analyze content from HTML
 */
export function analyzeContent(html: string, url: string): ContentAnalysis {
  const $ = cheerio.load(html);
  
  // Extract main content (remove scripts, styles, nav, footer)
  $('script, style, nav, footer, header, aside, .nav, .footer, .header, .sidebar').remove();
  const mainText = $('body').text();
  
  // Clean text
  const cleanText = mainText
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,!?;:()-]/g, '')
    .trim();
  
  // Word analysis
  const words = cleanText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const uniqueWords = new Set(words);
  const totalWords = words.length;
  const averageWordLength = words.reduce((sum, w) => sum + w.length, 0) / totalWords || 0;
  
  // Sentence analysis
  const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const totalSentences = sentences.length;
  const averageWordsPerSentence = totalWords / totalSentences || 0;
  
  // Syllable count (approximation)
  const totalSyllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  const averageSyllablesPerWord = totalSyllables / totalWords || 0;
  
  // Flesch Reading Ease score
  const fleschScore = calculateFleschScore(
    totalWords,
    totalSentences,
    totalSyllables
  );
  
  // Reading grade level
  const gradeLevel = calculateGradeLevel(fleschScore);
  const rating = getRatingFromScore(fleschScore);
  
  // Keyword extraction (top 10 most common words, excluding stop words)
  const stopWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  ]);
  
  const wordCounts = new Map<string, number>();
  words.forEach(word => {
    if (word.length > 3 && !stopWords.has(word)) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  });
  
  const keywords = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({
      word,
      count,
      density: (count / totalWords) * 100,
    }));
  
  // Structure analysis
  const domain = new URL(url).hostname;
  const internalLinks = $('a[href]').filter((_, el) => {
    const href = $(el).attr('href') || '';
    return href.includes(domain) || href.startsWith('/');
  }).length;
  
  const externalLinks = $('a[href]').filter((_, el) => {
    const href = $(el).attr('href') || '';
    return !href.includes(domain) && !href.startsWith('/') && href.startsWith('http');
  }).length;
  
  return {
    readability: {
      score: Math.round(fleschScore),
      grade: gradeLevel,
      rating,
    },
    words: {
      total: totalWords,
      unique: uniqueWords.size,
      averageLength: Math.round(averageWordLength * 10) / 10,
    },
    sentences: {
      total: totalSentences,
      averageWordsPerSentence: Math.round(averageWordsPerSentence * 10) / 10,
      averageSyllablesPerWord: Math.round(averageSyllablesPerWord * 10) / 10,
    },
    keywords,
    structure: {
      headings: {
        h1: $('h1').length,
        h2: $('h2').length,
        h3: $('h3').length,
        h4: $('h4').length,
        h5: $('h5').length,
        h6: $('h6').length,
      },
      paragraphs: $('p').length,
      lists: $('ul, ol').length,
      images: $('img').length,
      links: {
        internal: internalLinks,
        external: externalLinks,
      },
    },
  };
}

/**
 * Count syllables in a word (approximation)
 */
function countSyllables(word: string): number {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  
  const syllables = word.match(/[aeiouy]{1,2}/g);
  return syllables ? syllables.length : 1;
}

/**
 * Calculate Flesch Reading Ease score
 * Formula: 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
 */
function calculateFleschScore(
  words: number,
  sentences: number,
  syllables: number
): number {
  if (words === 0 || sentences === 0) return 0;
  
  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  return Math.max(0, Math.min(100, score));
}

/**
 * Convert Flesch score to grade level
 */
function calculateGradeLevel(fleschScore: number): string {
  if (fleschScore >= 90) return '5th grade';
  if (fleschScore >= 80) return '6th grade';
  if (fleschScore >= 70) return '7th grade';
  if (fleschScore >= 60) return '8th-9th grade';
  if (fleschScore >= 50) return '10th-12th grade';
  if (fleschScore >= 30) return 'College';
  return 'College graduate';
}

/**
 * Get rating from Flesch score
 */
function getRatingFromScore(
  fleschScore: number
): ContentAnalysis['readability']['rating'] {
  if (fleschScore >= 90) return 'very-easy';
  if (fleschScore >= 80) return 'easy';
  if (fleschScore >= 70) return 'fairly-easy';
  if (fleschScore >= 60) return 'standard';
  if (fleschScore >= 50) return 'fairly-difficult';
  if (fleschScore >= 30) return 'difficult';
  return 'very-difficult';
}
