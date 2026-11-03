const C = {
  bg: '#F3F7FA',
  paper: '#FFFFFF',
  steel: '#D9E5EF',
  steelMid: '#AFC3D4',
  steelDark: '#6D8497',
  onyx: '#20272E',
  onyxSoft: '#4C5964',
  muted: '#82909B',
  line: '#E4EBF0',
  scarlet: '#FF2400',
  scarletWash: '#FFF0EC',
  green: '#3F8A72',
  greenWash: '#EAF5F0',
  gold: '#D69A34',
  lilac: '#8172B3',
};
const CATEGORIES = ['Groceries', 'Dining', 'Transport', 'Housing', 'Subscriptions', 'Shopping', 'Utilities', 'Health', 'Other'];
const CATEGORY_ICONS: Record<string, string> = {
  Groceries: '◈', Dining: '♨', Transport: '↗', Housing: '⌂', Subscriptions: '▣', Shopping: '◇', Utilities: 'ϟ', Health: '+', Other: '•',
};
export { C, CATEGORIES, CATEGORY_ICONS };
