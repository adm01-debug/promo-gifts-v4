// Palavras que devem permanecer em minúsculo (preposições, artigos, conjunções)
const LOWERCASE_WORDS = [
  'e',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'em',
  'na',
  'no',
  'nas',
  'nos',
  'para',
  'por',
  'com',
];

/**
 * Formata string em Title Case (Primeira Maiúscula, exceto preposições)
 * Primeira palavra sempre capitalizada.
 */
export const toTitleCase = (str: string): string => {
  return str
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      if (index === 0 || !LOWERCASE_WORDS.includes(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(' ');
};
