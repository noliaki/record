export async function wait(interval = 500): Promise<void> {
  return await new Promise((resolve: () => void): void => {
    window.setTimeout(() => {
      resolve()
    }, interval)
  })
}
