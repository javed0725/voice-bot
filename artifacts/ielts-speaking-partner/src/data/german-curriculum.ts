export type CEFR = 'A1' | 'A2' | 'B1' | 'B2';

export interface GermanDay {
  id: string;
  level: CEFR;
  dayNumber: number;
  topic: string;
  keyPoints: string;
}

export interface GermanLevel {
  level: CEFR;
  label: string;
  description: string;
  color: string;
  textColor: string;
  days: GermanDay[];
}

export const GERMAN_CURRICULUM: GermanLevel[] = [
  {
    level: 'A1',
    label: 'Beginner',
    description: 'First words, greetings, numbers',
    color: '#22C55E',
    textColor: '#14532D',
    days: [
      {
        id: 'A1-1', level: 'A1', dayNumber: 1,
        topic: 'Greetings & Introductions',
        keyPoints: '- Hallo, Guten Morgen, Guten Tag, Guten Abend, Tschüss, Auf Wiedersehen\n- Ich heiße... / Wie heißt du?\n- Woher kommst du? / Ich komme aus...\n- Wie geht es dir? / Gut, danke!',
      },
      {
        id: 'A1-2', level: 'A1', dayNumber: 2,
        topic: 'Numbers 1–20 & Basic Questions',
        keyPoints: '- eins, zwei, drei, vier, fünf, sechs, sieben, acht, neun, zehn, elf, zwölf, dreizehn, vierzehn, fünfzehn, sechzehn, siebzehn, achtzehn, neunzehn, zwanzig\n- Wie alt bist du? / Ich bin ... Jahre alt.\n- Was ist das? / Das ist...\n- Wie viel kostet das?',
      },
      {
        id: 'A1-3', level: 'A1', dayNumber: 3,
        topic: 'Colors & Everyday Objects',
        keyPoints: '- Colors: rot, blau, grün, gelb, schwarz, weiß, orange, lila, grau, braun\n- Articles + nouns: der Tisch (m), die Lampe (f), das Buch (n)\n- Das ist ein/eine...\n- Welche Farbe hat...?',
      },
      {
        id: 'A1-4', level: 'A1', dayNumber: 4,
        topic: 'Days, Months & Time',
        keyPoints: '- Days: Montag, Dienstag, Mittwoch, Donnerstag, Freitag, Samstag, Sonntag\n- Months: Januar, Februar, März, April, Mai, Juni, Juli, August, September, Oktober, November, Dezember\n- Wie spät ist es? / Es ist ... Uhr.\n- heute (today), morgen (tomorrow), gestern (yesterday)',
      },
      {
        id: 'A1-5', level: 'A1', dayNumber: 5,
        topic: 'Family Members & Possessives',
        keyPoints: '- Family: die Mutter, der Vater, die Schwester, der Bruder, die Großmutter, der Großvater, das Kind\n- mein/meine (my), dein/deine (your)\n- Das ist meine Mutter.\n- Ich habe einen Bruder und eine Schwester.',
      },
    ],
  },
  {
    level: 'A2',
    label: 'Elementary',
    description: 'Grammar cases, modal verbs, past tense',
    color: '#3B82F6',
    textColor: '#1E3A8A',
    days: [
      {
        id: 'A2-1', level: 'A2', dayNumber: 1,
        topic: 'Der / Die / Das — Nominativ',
        keyPoints: '- Definite articles: der (masculine), die (feminine), das (neuter), die (plural)\n- Indefinite: ein (m/n), eine (f)\n- Kein/keine for negation\n- Subject identification in a sentence',
      },
      {
        id: 'A2-2', level: 'A2', dayNumber: 2,
        topic: 'Akkusativ — Direct Objects',
        keyPoints: '- Akkusativ changes: den (m only!), die (f), das (n), die (pl)\n- Verbs requiring Akkusativ: haben, sehen, kaufen, essen, trinken, lieben\n- Ich kaufe den Apfel. / Sie sieht einen Film.\n- Ich habe keinen Hunger.',
      },
      {
        id: 'A2-3', level: 'A2', dayNumber: 3,
        topic: 'Dativ — Prepositions & Indirect Objects',
        keyPoints: '- Dativ articles: dem (m/n), der (f), den+n (pl)\n- Dativ prepositions: mit, bei, nach, von, zu, aus, seit, gegenüber\n- Ich fahre mit dem Bus. / Das Buch gehört mir.\n- Ich helfe meiner Mutter.',
      },
      {
        id: 'A2-4', level: 'A2', dayNumber: 4,
        topic: 'Modal Verbs',
        keyPoints: '- können (can), müssen (must), wollen (want), dürfen (may/allowed), sollen (should), möchten (would like)\n- Pattern: modal is conjugated; main verb goes to end as infinitive\n- Ich muss arbeiten. / Er kann schwimmen.\n- Darf ich hier rauchen? / Ich möchte Kaffee.',
      },
      {
        id: 'A2-5', level: 'A2', dayNumber: 5,
        topic: 'Perfekt — Conversational Past Tense',
        keyPoints: '- haben + past participle: Ich habe gegessen, getrunken, geschlafen\n- sein + past participle (movement/change): Ich bin gegangen, gefahren, gekommen\n- Regular: ge- + stem + -(e)t (gemacht, gespielt)\n- Irregular: gehen→gegangen, sehen→gesehen, trinken→getrunken',
      },
    ],
  },
  {
    level: 'B1',
    label: 'Intermediate',
    description: 'Complex clauses, conditionals, opinions',
    color: '#F59E0B',
    textColor: '#78350F',
    days: [
      {
        id: 'B1-1', level: 'B1', dayNumber: 1,
        topic: 'Nebensätze — Subordinate Clauses',
        keyPoints: '- Conjunctions that send verb to end: weil (because), dass (that), wenn (when/if), obwohl (although), bevor (before), nachdem (after)\n- Ich bleibe zu Hause, weil ich krank bin.\n- Er sagt, dass er morgen kommt.\n- Wenn ich Zeit habe, gehe ich spazieren.',
      },
      {
        id: 'B1-2', level: 'B1', dayNumber: 2,
        topic: 'Wechselpräpositionen — Two-Way Prepositions',
        keyPoints: '- an, auf, hinter, in, neben, über, unter, vor, zwischen\n- Dativ for location (Wo?): Das Buch liegt auf dem Tisch.\n- Akkusativ for movement (Wohin?): Ich lege das Buch auf den Tisch.\n- Key pairs: liegen/legen, sitzen/setzen, stehen/stellen, hängen',
      },
      {
        id: 'B1-3', level: 'B1', dayNumber: 3,
        topic: 'Reflexive Verbs',
        keyPoints: '- Reflexive pronouns: mich, dich, sich, uns, euch, sich\n- Common verbs: sich freuen (to be happy), sich waschen (to wash), sich erinnern (to remember), sich vorstellen (to introduce oneself), sich ärgern (to be annoyed)\n- Ich freue mich auf den Urlaub.\n- Erinnerst du dich an ihn?',
      },
      {
        id: 'B1-4', level: 'B1', dayNumber: 4,
        topic: 'Konjunktiv II — Conditional & Wishes',
        keyPoints: '- würde + infinitive: Ich würde gern reisen.\n- Key forms: wäre (were/would be), hätte (would have), könnte (could), müsste (would have to)\n- Wenn ich reich wäre, würde ich reisen.\n- Das wäre schön! / Könntest du mir helfen?',
      },
      {
        id: 'B1-5', level: 'B1', dayNumber: 5,
        topic: 'Expressing Opinions & Arguments',
        keyPoints: '- Meiner Meinung nach... / Ich finde, dass...\n- Ich denke/glaube, dass... / Ich bin der Meinung, dass...\n- Einerseits... andererseits... (On one hand... on the other)\n- Das stimmt, aber... / Ich bin anderer Meinung.\n- Zustimmen und Widersprechen: Genau! / Das sehe ich anders.',
      },
    ],
  },
  {
    level: 'B2',
    label: 'Upper-Intermediate',
    description: 'Passive, relative clauses, formal language',
    color: '#8B5CF6',
    textColor: '#4C1D95',
    days: [
      {
        id: 'B2-1', level: 'B2', dayNumber: 1,
        topic: 'Passiv — Passive Voice',
        keyPoints: '- Vorgangspassiv: werden + past participle. Das Auto wird repariert.\n- Passiv with modal: Das muss gemacht werden.\n- Zustandspassiv (state): Das Fenster ist geöffnet. (sein + past participle)\n- Why passive: impersonal, formal, scientific writing',
      },
      {
        id: 'B2-2', level: 'B2', dayNumber: 2,
        topic: 'Relativsätze — Relative Clauses',
        keyPoints: '- Relative pronoun agrees in gender+number with the noun it refers to: der, die, das, die\n- Case depends on the role in the relative clause\n- Das Buch, das ich lese, ist spannend.\n- Der Mann, dem ich geholfen habe, ist nett.\n- Die Frau, deren Name ich kenne, ist Ärztin.',
      },
      {
        id: 'B2-3', level: 'B2', dayNumber: 3,
        topic: 'Advanced Prepositions & Fixed Phrases',
        keyPoints: '- Genitive prepositions: wegen (because of), trotz (despite), während (during), statt (instead of)\n- Verb+preposition combos: warten auf (Akk), sich freuen über (Akk), denken an (Akk), sprechen über (Akk)\n- Pronominaladverbien: darauf, dafür, darüber\n- Formal connectors: jedoch, dennoch, daher, folglich',
      },
      {
        id: 'B2-4', level: 'B2', dayNumber: 4,
        topic: 'Formal Language & Written German',
        keyPoints: '- Formal register: Sie vs du / Ihr\n- Email openings: Sehr geehrte Damen und Herren, / Sehr geehrte/r Frau/Herr...\n- Email closings: Mit freundlichen Grüßen / Hochachtungsvoll\n- Nominalization: die Entscheidung (deciding), die Durchführung (executing)\n- Formal connectors: im Hinblick auf, bezüglich, hinsichtlich',
      },
      {
        id: 'B2-5', level: 'B2', dayNumber: 5,
        topic: 'Debate & Complex Argumentation',
        keyPoints: '- Argument structure: These (claim) → Begründung (reasoning) → Beispiel (example) → Schluss (conclusion)\n- Conceding: Zwar... aber... / Auch wenn..., trotzdem...\n- Rhetorical devices: rhetorical questions, repetition, contrast\n- Topics: Umwelt, Digitalisierung, Globalisierung, Bildung in German',
      },
    ],
  },
];

export const ALL_DAY_IDS: string[] = GERMAN_CURRICULUM.flatMap(l => l.days.map(d => d.id));

export function getDayById(id: string): GermanDay | undefined {
  return GERMAN_CURRICULUM.flatMap(l => l.days).find(d => d.id === id);
}

export function getLevelById(id: string): GermanLevel | undefined {
  return GERMAN_CURRICULUM.find(l => l.level === id);
}

export function getNextDayId(id: string): string | null {
  const idx = ALL_DAY_IDS.indexOf(id);
  if (idx === -1 || idx === ALL_DAY_IDS.length - 1) return null;
  return ALL_DAY_IDS[idx + 1];
}
