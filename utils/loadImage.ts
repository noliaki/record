export async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise(
    (
      resolve: (image: HTMLImageElement) => void,
      reject: (reason: ErrorEvent) => void
    ) => {
      const image: HTMLImageElement = new Image()

      image.addEventListener(
        'load',
        (_event: Event): void => {
          resolve(image)
        },
        {
          once: true,
        }
      )

      image.addEventListener('error', (event: ErrorEvent): void => {
        reject(event)
      })

      image.src = src
    }
  )
}
