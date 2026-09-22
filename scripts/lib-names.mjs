// 機種名の突き合わせ用。頭の L／スマスロ／パチスロ／S、全角半角、ローマ数字、記号の違いを無視する
const ROMAN = { 'Ⅰ': '1', 'Ⅱ': '2', 'Ⅲ': '3', 'Ⅳ': '4', 'Ⅴ': '5', 'Ⅵ': '6', 'Ⅶ': '7', 'Ⅷ': '8', 'Ⅸ': '9', 'Ⅹ': '10' };
export const norm = (s) => String(s ?? '').normalize('NFKC').replace(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/g, (c) => ROMAN[c] ?? c)
  .replace(/(VIII|VII|VI|IV|IX|III|II)(?![A-Za-z])/g, (r) => ({ II: '2', III: '3', IV: '4', VI: '6', VII: '7', VIII: '8', IX: '9' }[r]))
  .replace(/^(超スマスロ|スマスロ|Lパチスロ|パチスロ|Lスロット|スロット|L|S)\s*/i, '')
  .replace(/[\s・\-－ー～〜~!！?？、。,.()（）「」『』【】:：/／'"]/g, '').toLowerCase();
