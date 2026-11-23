import loop from './loop.js'
import select from './select.js'
import mutate from './mutate.js'
import survive from './survive.js'

export const name = 'dsh-gap-search'
export const inject = ['evolve']

/**
 * Replace loop, select, mutate, and survive. The evaluate slot is left on python-subprocess.
 * @param {object} ctx
 */
export function apply(ctx) {
  ctx.effect(() => {
    const dispose = [
      ctx.evolve.register('loop', loop),
      ctx.evolve.register('select', select),
      ctx.evolve.register('mutate', mutate),
      ctx.evolve.register('survive', survive),
    ]
    return () => {
      for (const undo of dispose) undo()
    }
  })
}
