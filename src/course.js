// The course: a fixed path through every lesson. Each part is practised piano-only, step by step,
// in each of the lesson's keys, and then once with the band.
import { LESSONS } from './lessons.js';

export const COURSE = LESSONS.flatMap((lesson) =>
  lesson.parts.flatMap((partId) => [
    ...(lesson.keys || [lesson.key]).map((key) => ({ lessonId: lesson.id, partId, key, band: false })),
    { lessonId: lesson.id, partId, key: lesson.key, band: true },
  ]),
).map((ex, index) => ({ ...ex, index, id: `${ex.lessonId}/${ex.partId}/${ex.key}/${ex.band ? 'band' : 'piano'}` }));

// A lesson's exercises in order; `n` is the 1-based number shown on its card.
export const exercisesOf = (lessonId) => COURSE.filter((e) => e.lessonId === lessonId).map((e, i) => ({ ...e, n: i + 1 }));
