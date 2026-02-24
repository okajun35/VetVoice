/**
 * Dictionary_Expander component
 * Feature: vet-voice-medical-record
 * Task 4.2
 * 
 * Rule-based dictionary lookup for expanding veterinary abbreviations.
 * LLM: Not used (deterministic rule-based)
 * Dependencies: None (pure function)
 * 
 * Requirements: 4.1, 4.2, 4.4, 4.5, 15.4
 */

import { DICTIONARY_CSV } from "./generated/dictionary-data";
/**
 * Dictionary entry structure
 */
export interface DictionaryEntry {
  canonical: string;          // Canonical form (e.g., "静脈注射")
  abbreviations: string[];    // List of abbreviations (e.g., ["静注", "IV", "静脈内注射"])
  category?: string;          // Optional category (e.g., "投与経路")
}

/**
 * Expansion record
 */
export interface Expansion {
  original: string;           // Original abbreviation found in text
  expanded: string;           // Expanded canonical form
  position: number;           // Position in original text
}

/**
 * Expansion result
 */
export interface ExpanderOutput {
  expanded_text: string;      // Text with abbreviations expanded
  expansions: Expansion[];    // List of expansions performed
}

/**
 * Module-level cache for dictionary entries
 * Loaded once on cold start for Lambda performance optimization
 */
let dictionaryCache: DictionaryEntry[] | null = null;

/**
 * Load dictionary from CSV file
 * CSV format: 正式名称,略語1,略語2,略語3,...
 * 
 * @returns Array of dictionary entries
 */
function loadDictionary(): DictionaryEntry[] {
  if (dictionaryCache) {
    return dictionaryCache;
  }

  const lines = DICTIONARY_CSV.split("\n").slice(1); // Skip header row

  dictionaryCache = lines
    .filter((line) => line.trim()) // Skip empty lines
    .map((line) => {
      const parts = line.split(",").map((s) => s.trim());
      const [canonical, ...abbreviations] = parts;
      
      return {
        canonical,
        abbreviations: abbreviations.filter((a) => a), // Remove empty strings
      };
    });

  return dictionaryCache;
}

/**
 * Build abbreviation-to-canonical mapping from dictionary
 * 
 * @param dictionary Array of dictionary entries
 * @returns Map from abbreviation to canonical form
 */
function buildAbbreviationMap(
  dictionary: DictionaryEntry[]
): Map<string, string> {
  const map = new Map<string, string>();

  for (const entry of dictionary) {
    // Map each abbreviation to its canonical form
    for (const abbr of entry.abbreviations) {
      map.set(abbr, entry.canonical);
    }
  }

  return map;
}

/**
 * Expand abbreviations in text using dictionary
 * 
 * This is a pure function with deterministic behavior:
 * - Same input always produces same output
 * - No side effects
 * - No LLM usage
 * 
 * Algorithm:
 * 1. Load dictionary (cached on first call)
 * 2. Build abbreviation-to-canonical mapping
 * 3. Find all abbreviations in text (whole word matching)
 * 4. Replace abbreviations with canonical forms
 * 5. Track expansion positions and details
 * 
 * @param text Input text with potential abbreviations
 * @returns Expanded text and list of expansions performed
 */
export function expand(text: string): ExpanderOutput {
  // Handle empty input
  if (!text) {
    return {
      expanded_text: "",
      expansions: [],
    };
  }

  // Load dictionary and build mapping
  const dictionary = loadDictionary();
  const abbrMap = buildAbbreviationMap(dictionary);

  // If dictionary is empty, return original text
  if (abbrMap.size === 0) {
    return {
      expanded_text: text,
      expansions: [],
    };
  }

  // Sort abbreviations by length (longest first) to handle overlapping matches
  const abbreviations = Array.from(abbrMap.keys()).sort(
    (a, b) => b.length - a.length
  );

  // Returns the script class of a character for boundary detection
  function scriptClass(char: string): "ascii" | "cjk" | "other" {
    if (/[a-zA-Z]/.test(char)) return "ascii";
    if (/[\u30A0-\u30FF\u4E00-\u9FFF\uFF21-\uFF3A\uFF41-\uFF5A]/.test(char)) return "cjk";
    return "other";
  }

  // Helper function to check if there is a word boundary between an abbreviation edge and an adjacent character.
  // A boundary exists when:
  //   - The adjacent character is absent (start/end of string)
  //   - The adjacent character is a non-word character (digits, spaces, punctuation, Hiragana, symbols)
  //   - The adjacent character is a different script class from the abbreviation edge (e.g. ASCII next to Kanji)
  function isWordBoundary(abbrEdgeChar: string, adjacentChar: string | undefined): boolean {
    if (!adjacentChar) return true; // Start/end of string

    const adjClass = scriptClass(adjacentChar);

    // Non-word characters (digits, spaces, punctuation, Hiragana, etc.) are always boundaries
    if (adjClass === "other") return true;

    // Script switch between abbreviation edge and adjacent char is a boundary
    // e.g. ASCII abbreviation "IV" next to Kanji, or Kanji abbreviation "静注" next to ASCII letter
    const abbrClass = scriptClass(abbrEdgeChar);
    if (abbrClass !== adjClass) return true;

    // Same script class — not a boundary (e.g. "ABPC" inside "XABPCY")
    return false;
  }

  // Build a list of all matches first
  interface Match {
    abbr: string;
    canonical: string;
    position: number;
  }
  const allMatches: Match[] = [];

  for (const abbr of abbreviations) {
    const canonical = abbrMap.get(abbr)!;
    let searchPos = 0;

    while (searchPos < text.length) {
      const index = text.indexOf(abbr, searchPos);
      if (index === -1) break;

      // Check if it's a whole word match
      const beforeChar = index > 0 ? text[index - 1] : undefined;
      const afterChar = index + abbr.length < text.length ? text[index + abbr.length] : undefined;
      
      const isWordBoundaryBefore = isWordBoundary(abbr[0], beforeChar);
      const isWordBoundaryAfter = isWordBoundary(abbr[abbr.length - 1], afterChar);

      if (isWordBoundaryBefore && isWordBoundaryAfter) {
        allMatches.push({ abbr, canonical, position: index });
      }

      searchPos = index + 1;
    }
  }

  // Sort matches by position
  allMatches.sort((a, b) => a.position - b.position);

  // Remove overlapping matches (keep first occurrence)
  const nonOverlappingMatches: Match[] = [];
  let lastEnd = -1;

  for (const match of allMatches) {
    if (match.position >= lastEnd) {
      nonOverlappingMatches.push(match);
      lastEnd = match.position + match.abbr.length;
    }
  }

  // Build expanded text and track expansions
  // Process from start to end, building new string
  let expandedText = "";
  let lastPosition = 0;
  const expansions: Expansion[] = [];

  for (const match of nonOverlappingMatches) {
    // Add text before this match
    expandedText += text.substring(lastPosition, match.position);
    
    // Add expanded form
    expandedText += match.canonical;
    
    // Record expansion
    expansions.push({
      original: match.abbr,
      expanded: match.canonical,
      position: match.position,
    });
    
    // Update position
    lastPosition = match.position + match.abbr.length;
  }

  // Add remaining text
  expandedText += text.substring(lastPosition);

  return {
    expanded_text: expandedText,
    expansions,
  };
}

/**
 * Reset dictionary cache (for testing purposes)
 * @internal
 */
export function resetDictionaryCache(): void {
  dictionaryCache = null;
}

