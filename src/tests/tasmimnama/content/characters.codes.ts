export const CHARACTER_CODES = ['DAVINCI', 'EINSTEIN', 'LINCOLN', 'CHURCHILL', 'EDISON'] as const;
export type CharacterCode = (typeof CHARACTER_CODES)[number];
