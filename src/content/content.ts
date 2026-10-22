/**
 * ────────────────────────────────────────────────────────────────
 *  CONTENT CONFIGURATION
 *  Everything here is a safe example placeholder. Replace the text
 *  with your own words. Nothing in this file is secret: it ships in
 *  the public JavaScript bundle. Keep the real love letter, portal
 *  answers and photos in Supabase (edit them in-game as the owner).
 * ────────────────────────────────────────────────────────────────
 */
import type { Photo, WorldContent } from '../types'

// Bundled through Vite so they also work in the single-file build opened straight from disk.
const bundled = import.meta.glob('./placeholders/*.svg', { query: '?url', import: 'default', eager: true }) as Record<string, string>

export const content: WorldContent = {
  title: 'Our Little World',
  welcomeLine: 'A tiny garden, a cake, and a few memories. Made just for you.',
  whoPrompt: 'Who is entering our little world?',
  signText: 'happy 25! sweetheart',
  wishText: 'May your wishes come true!',
  enterButton: 'Step inside',
  roles: {
    me: {
      label: 'Me',
      displayName: 'Me',
      avatar: { kind: 'male', skin: '#EBC3A2', hair: '#4A3A30', top: '#7F95A8', bottom: '#5B6470', shoes: '#F2EFE9' },
      questions: [
        {
          id: 'me-1',
          prompt: 'Example question: what is the name of this world?',
          acceptedAnswers: ['our little world'],
          hint: 'It is written on the welcome screen.',
          placeholder: 'Type your answer',
        },
        {
          id: 'me-2',
          prompt: 'Example question: whose birthday are we celebrating?',
          acceptedAnswers: [],
          hint: 'Any answer works for this one.',
          placeholder: 'Optional, any answer is fine',
        },
      ],
    },
    sweetheart: {
      label: 'Sweetheart',
      displayName: 'Sweetheart',
      avatar: { kind: 'female', skin: '#F0CBB0', hair: '#5A3B2E', top: '#E3B8B2', bottom: '#C9A2A6', shoes: '#F7F2EC' },
      questions: [
        {
          id: 'sw-1',
          prompt: 'Example question: which birthday is this?',
          acceptedAnswers: ['25', '25th', 'twenty five', 'twentyfive', 'twenty-five', 'twenty fifth'],
          hint: 'Count the candles. It is a quarter of a century.',
          placeholder: 'A number',
        },
        {
          id: 'sw-2',
          prompt: 'Example question: what is your favourite season?',
          acceptedAnswers: [],
          hint: 'There is no wrong answer here.',
          placeholder: 'Optional, any answer is fine',
        },
        {
          id: 'sw-3',
          prompt: 'Example question: tea or coffee?',
          acceptedAnswers: [],
          placeholder: 'Optional, any answer is fine',
        },
      ],
    },
  },
  // Demo mode only (no Supabase). Leave empty for no code.
  demoAccessCode: '',
}

/** Example gallery shown until real photos are uploaded through the owner editor. */
const placeholderAspects = [1.5, 0.75, 1, 1.3325, 0.8, 1.7775, 1.5, 0.6675, 1.25, 1, 1.5, 0.75, 1.3325, 1.5, 0.8, 1.5]
const walls: Photo['wall'][] = ['left', 'left', 'left', 'left', 'left', 'left', 'back', 'back', 'back', 'back', 'right', 'right', 'right', 'right', 'right', 'right']

export const placeholderPhotos: Photo[] = placeholderAspects.map((aspect, i) => ({
  id: `placeholder-${i + 1}`,
  src: resolveBundled(bundlePath(i)),
  storagePath: bundlePath(i),
  caption: `Placeholder memory ${i + 1}. Replace this picture and caption in the gallery editor.`,
  wall: walls[i],
  order: i,
  aspect,
  placeholder: true,
}))

function bundlePath(i: number) {
  return `bundle:placeholders/memory-${String(i + 1).padStart(2, '0')}.svg`
}

/** Resolves a "bundle:" storage path (an asset shipped in /public) to a URL. */
export function resolveBundled(path: string) {
  const file = path.replace(/^bundle:placeholders\//, '')
  return bundled[`./placeholders/${file}`] ?? ''
}

