export const TARGET_LANGUAGES = [
  "English","Hindi","Bengali","Tamil","Telugu","Marathi","Gujarati","Kannada",
  "Malayalam","Punjabi","Urdu","Nepali","French","Spanish","German","Italian",
  "Portuguese","Arabic","Chinese","Japanese","Korean","Russian","Turkish",
] as const;

export type TargetLanguage = typeof TARGET_LANGUAGES[number];
