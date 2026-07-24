import raw from '@/src/data/skillContent.json';

/** Learner-facing knowledge-base entry for one skill (from Partyka's materials). */
export type SkillContent = {
  tagline: string;
  summary: string;
  howItWorks: string;
  leaderCues: string[];
  followerCues: string[];
  commonMistakes: string[];
  video?: string; // captured from the source lesson; not surfaced yet (text-only for now)
  lessonRefs?: string[];
};

const CONTENT = raw as Record<string, SkillContent>;

export function getSkillContent(slug: string): SkillContent | null {
  return CONTENT[slug] ?? null;
}
export function hasSkillContent(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(CONTENT, slug);
}

/** Short overviews for the 13 categories (shown on the /skills index and skill pages). */
export const CATEGORY_OVERVIEW: Record<string, string> = {
  PARTNER:
    'Everything the dance is built on: the look and nod that starts it, the embrace that carries it, and the shared listening that lets two people move as one.',
  BODY:
    'Your own instrument. A grounded, upright axis and the ability to turn your chest independently of your hips are what make every figure clean and every lead legible.',
  STEP:
    'The vocabulary of the feet — walking, the cross, weight changes, stepping outside the partner. Master the walk and most of tango takes care of itself.',
  RHYTHM:
    'Dancing the music rather than dancing to it. Timing, double-time, the syncopated traspié, and knowing how the great orchestras want to be danced.',
  ROTATION:
    'Everything that turns: ochos, the giro, the ocho cortado. Rotation is where dissociation, timing and navigation meet and where tango really starts to spin.',
  SPACE:
    'Reading and using the floor — the line of dance, the ronda, and the sacadas that let you step into space your partner just left.',
  CONTACT:
    'Figures where legs and feet meet: paradas, sandwiches, sweeps and the gancho. Intimate, playful, and all about clear, safe contact.',
  'FREE LEG':
    'What the unweighted leg does — decorations, the whip of a boleo, the glide of a planeo. Freedom that only exists on top of a solid axis.',
  'OFF AXIS':
    'Leaving your own vertical to share a single axis with your partner: the volcada leaning in, the colgada leaning out. Trust, counterbalance, and control.',
  DYNAMICS:
    'The energy of the dance — bounce and rebound, releasing and re-catching the embrace. How you use elasticity and the floor to create movement.',
  GENRE:
    'The three musics of the milonga: the sweep of vals, the cheeky drive of milonga, and the folk lilt of chacarera. Each asks for a different body.',
  STYLE:
    'The great ways to dance tango — spacious salón, chest-to-chest milonguero, and the open, elastic language of nuevo. Same dance, different accents.',
  MASTERY:
    'Where technique becomes dancing: real improvisation, and knowing how to stop, resolve, and end with the music.',
};

export function getCategoryOverview(tag: string): string | null {
  return CATEGORY_OVERVIEW[tag] ?? null;
}
