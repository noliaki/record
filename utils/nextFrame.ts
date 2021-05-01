const raf = window.requestAnimationFrame

export function nextFrame(cb: () => any): void {
  raf((): void => {
    raf((): void => {
      cb()
    })
  })
}
