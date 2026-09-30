const tagalogWords = new Set(
  `ako ikaw siya kami tayo sila ito iyan iyon ano sino saan kailan bakit paano
   hindi oo opo salamat kumusta mahal kita gusto niya namin natin nila
   ang ng mga sa para pero dahil kung kapag habang mula hanggang
   bahay pamilya kaibigan trabaho paaralan pagkain tubig araw gabi umaga
   maganda pangit masaya malungkot mabilis mabagal maliit malaki bago luma
   kain inom tulog lakad takbo punta uwi bili bili ko siya natin lang naman
   ngayon bukas kahapon kanina mamaya dito doon rito roon lahat ilan marami
   mayroon wala kailangan dapat pwede maaari ayaw gusto alam isip puso buhay
   bata matanda lalaki babae anak asawa kausap kaibigan kaibigan ko
   pumunta umuwi kumain nagluto nag-aaral nagtrabaho mag-aaral nagpunta
   ginagawa ginawa magiging ginagamit gamitin sinasabi sabihin nagsabi
   nagsulat sumulat basahin basa sulat tulong tumulong problema tanong sagot
   mabuti masama totoo siguro talaga kasi pala nga rin din naman lang muna
   po ba raw daw yata sana lamang ngunit subalit o at ni kay kina
   akin iyo kanya atin amin inyo kanila ikaw ako siya sila tayo kami kayo
   ito iyan iyon ganito ganyan ganoon alin bawat ibang ganap minsan palagi
   hindi pa rin na lang daw raw ba po naman kasi yata sana muna`.split(/\s+/),
);

const wordPattern = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu;

export function isNonEnglishWord(word) {
  const normalizedWord = word.toLocaleLowerCase("en");
  return /[^\p{Script=Latin}]/u.test(word) || tagalogWords.has(normalizedWord);
}

export function findNonEnglishWords(text) {
  return [...new Set(text.match(wordPattern) ?? [])].filter(isNonEnglishWord);
}
