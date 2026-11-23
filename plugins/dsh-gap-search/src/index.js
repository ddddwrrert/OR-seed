import { judge } from './accept.js'
import loop from './loop.js'
import select from './select.js'
import mutate from './mutate.js'
import { PERSONA, buildPrompt } from './prompt.js'
import { dropMechanism, pick, timeDirection } from './schedule.js'
import { decide } from './decide.js'
import survive from './survive.js'

export const name = 'dsh-gap-search'
export const inject = ['evolve']

/**
 * ALE-Bench starts on gap-search. A later evolve_define registration stacks on top
 * and becomes the active provider. The evaluate slot stays on python-subprocess.
 * evolve.gap is how a revised provider keeps the class, the one mechanism, and δ.
 * @param {object} ctx
 */
export function apply(ctx) {
  const gap = {
    decide,
    pick,
    dropMechanism,
    timeDirection,
    buildPrompt,
    judge,
    persona: PERSONA,
  }
  ctx.effect(() => {
    ctx.evolve.gap = gap
    const dispose = [
      ctx.evolve.register('loop', loop),
      ctx.evolve.register('select', select),
      ctx.evolve.register('mutate', mutate),
      ctx.evolve.register('survive', survive),
    ]
    return () => {
      for (const undo of dispose) undo()
      if (ctx.evolve.gap === gap) delete ctx.evolve.gap
    }
  })
}
