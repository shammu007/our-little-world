/**
 * Demo-mode secrets. This module is only loaded (lazily) when Supabase is NOT
 * configured, so it lives in its own chunk. In demo mode there is no server,
 * so these values are NOT protected. With Supabase configured, the real clue,
 * answers and letter live in the database and are edited in-game.
 */
import type { PortalSecret } from '../types'

export const demoPortal: PortalSecret = {
  clue: 'Example clue: I have keys but open no doors, and I play the songs you love. What am I?',
  hint: 'Example hint: you can find one with black and white keys.',
  acceptedAnswers: ['piano', 'a piano', 'keyboard'],
  letter: {
    title: 'A letter for you',
    greeting: 'Dear sweetheart,',
    paragraphs: [
      'This is a placeholder letter. Replace these words with your own in the gallery editor under "Portal & letter".',
      'Write about whatever you want to say on this birthday. The letter is only revealed after the right answer is given at the portal.',
      'Happy 25th birthday.',
    ],
    signature: 'With love, me',
  },
}
