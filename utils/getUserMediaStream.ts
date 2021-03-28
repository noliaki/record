export async function getUserMediaStream(
  constraints?: MediaStreamConstraints
): Promise<MediaStream> {
  const stream: MediaStream = await navigator.mediaDevices.getUserMedia(
    constraints
  )

  return stream
}
