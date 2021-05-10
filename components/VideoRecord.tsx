import Head from 'next/head'
import React, { useState, useRef, useEffect } from 'react'
import {
  load,
  SupportedPackages,
  FaceLandmarksPrediction,
} from '@tensorflow-models/face-landmarks-detection'
import '@tensorflow/tfjs-backend-webgl'
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  BufferGeometry,
  BufferAttribute,
  MeshBasicMaterial,
  Mesh,
  CanvasTexture,
  DoubleSide,
  MirroredRepeatWrapping,
} from 'three'
import { loadImage, TRIANGULATION } from '../utils'

declare global {
  interface HTMLCanvasElement {
    captureStream: (frameRate?: number) => MediaStream
  }
}

export default function VideoRecord(): JSX.Element {
  const chunk = useRef<Blob[]>([])
  const videoEl = useRef<HTMLVideoElement>(document.createElement('video'))
  const recordVideoEl = useRef<HTMLVideoElement | null>(null)
  const btnEl = useRef<HTMLButtonElement | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const renderer = useRef<WebGLRenderer>(
    new WebGLRenderer({
      alpha: true,
      preserveDrawingBuffer: true,
    })
  )
  const scene = useRef<Scene>(new Scene())
  const camera = useRef<PerspectiveCamera>(new PerspectiveCamera())
  const rafId = useRef<number | undefined>(undefined)
  const mesh = useRef<Mesh>(new Mesh())
  const model = useRef<any | null>(null)
  const inputEl = useRef<HTMLInputElement | null>(null)
  const fileReader = useRef<FileReader>(new FileReader())

  const faceSrcCanvas = useRef<HTMLCanvasElement | null>(null)
  const resultCanvas = useRef<HTMLCanvasElement | null>(null)
  const resultContext = useRef<CanvasRenderingContext2D | null>(null)

  const videoSize = useRef<{ width: number; height: number }>({
    width: 540,
    height: 960,
  })
  const hasFaceSrc = useRef<boolean>(false)

  const [isReady, setIsReady] = useState<boolean>(false)
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [recordedUrl, setRecordedUrl] = useState<string>('')

  async function init(): Promise<void> {
    await startVideo()

    createScene()
    createImageSrcCanvas()

    resultContext.current = resultCanvas.current?.getContext('2d') ?? null
    resultContext.current?.scale(-1, 1)
    resultContext.current?.translate(-resultContext.current.canvas.width, 1)

    model.current = await load(SupportedPackages.mediapipeFacemesh)
    await estimateAndUpdateFromVideo()

    render().catch(console.error)

    setIsReady(true)
  }

  function createImageSrcCanvas(): void {
    const position = new Float32Array(
      TRIANGULATION.map((_val) => [0, 0, 0]).flat()
    )
    const uv = new Float32Array(TRIANGULATION.map((_val) => [0, 0]).flat())

    mesh.current.geometry = new BufferGeometry()
    mesh.current.geometry.setAttribute(
      'position',
      new BufferAttribute(position, 3)
    )
    mesh.current.geometry.setAttribute('uv', new BufferAttribute(uv, 2))

    mesh.current.material = new MeshBasicMaterial({
      side: DoubleSide,
    })

    mesh.current.rotation.set(Math.PI, Math.PI, 0)
    scene.current.add(mesh.current)
  }

  async function updateFaceSrc(
    faceSrc: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    width: number,
    height: number
  ): Promise<void> {
    if (faceSrcCanvas.current === null) {
      return
    }

    const context = faceSrcCanvas.current.getContext('2d')

    if (context === null) {
      return
    }

    const prediction = await estimateFace(faceSrc)

    if (prediction === undefined) {
      alert('cannot find any faces in this image')
      return
    }

    context.clearRect(
      0,
      0,
      faceSrcCanvas.current.width ?? 500,
      faceSrcCanvas.current.height ?? 500
    )

    faceSrcCanvas.current.width = width
    faceSrcCanvas.current.height = height

    context.drawImage(faceSrc, 0, 0)

    const texture = new CanvasTexture(faceSrcCanvas.current)
    texture.flipY = false
    texture.wrapS = MirroredRepeatWrapping

    const uv = new Float32Array(
      TRIANGULATION.map((val: number) => [
        prediction.scaledMesh[val][0] / width,
        prediction.scaledMesh[val][1] / height,
      ]).flat()
    )

    const meshMaterial = mesh.current.material as MeshBasicMaterial

    updateUv(uv)

    meshMaterial.map = texture
    meshMaterial.needsUpdate = true

    hasFaceSrc.current = true
  }

  async function estimateFace(
    faceSrc: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
  ): Promise<FaceLandmarksPrediction | undefined> {
    if (model.current === null) {
      return
    }

    for (let i = 0; i < 10; i++) {
      const [prediction] = (await model.current.estimateFaces({
        input: faceSrc,
      })) as FaceLandmarksPrediction[]

      if (typeof prediction === 'undefined') {
        continue
      }

      if (prediction.faceInViewConfidence >= 1) {
        return prediction
      }
    }

    return undefined
  }

  function updatePosition(position: Float32Array): void {
    const arr = mesh.current.geometry.attributes.position.array
    const len = arr.length / 3
    const cX = videoSize.current.width / 2

    for (let i = 0; i < len; i++) {
      mesh.current.geometry.attributes.position.setXYZ(
        i,
        cX - (position[i * 3 + 0] - cX),
        position[i * 3 + 1],
        position[i * 3 + 2]
      )
    }

    mesh.current.geometry.attributes.position.needsUpdate = true
  }

  function updateUv(uv: Float32Array): void {
    const arr = mesh.current.geometry.attributes.uv.array
    const len = arr.length / 2

    for (let i = 0; i < len; i++) {
      mesh.current.geometry.attributes.uv.setXY(i, uv[i * 2 + 0], uv[i * 2 + 1])
    }

    mesh.current.geometry.attributes.uv.needsUpdate = true
  }

  async function startVideo(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
    })

    videoEl.current.srcObject = stream
    await videoEl.current.play().catch(console.error)

    const videoWidth = videoEl.current.videoWidth
    const videoHeight = videoEl.current.videoHeight

    videoSize.current.width = videoWidth
    videoSize.current.height = videoHeight

    renderer.current.setSize(videoWidth, videoHeight)

    if (resultCanvas.current === null) {
      return
    }

    resultCanvas.current.width = videoWidth
    resultCanvas.current.height = videoHeight
  }

  function createScene(): void {
    const fov = 1
    const fovRad = (fov / 2) * (Math.PI / 180)
    const dist = videoSize.current.height / 2 / Math.tan(fovRad)

    camera.current.fov = fov
    camera.current.aspect = videoSize.current.width / videoSize.current.height
    camera.current.near = 1
    camera.current.far = dist * 2

    camera.current.position.set(
      (videoSize.current.width / 2) * -1,
      (videoSize.current.height / 2) * -1,
      dist
    )

    camera.current.updateProjectionMatrix()
  }

  async function render(): Promise<void> {
    if (resultContext.current !== null) {
      resultContext.current.drawImage(videoEl.current, 0, 0)

      if (hasFaceSrc.current) {
        resultContext.current.drawImage(renderer.current.domElement, 0, 0)
        renderer.current.render(scene.current, camera.current)
      }
    }

    await estimateAndUpdateFromVideo()

    rafId.current = requestAnimationFrame(() => {
      render().catch(console.error)
    })
  }

  async function estimateAndUpdateFromVideo(): Promise<void> {
    if (model.current === null) {
      return
    }

    const [prediction] = (await model.current.estimateFaces({
      input: videoEl.current,
    })) as Array<
      FaceLandmarksPrediction & {
        scaledMesh: Array<[number, number, number]>
      }
    >

    if (prediction?.scaledMesh === undefined) {
      return
    }

    updatePosition(
      new Float32Array(
        TRIANGULATION.map((val: number) => prediction.scaledMesh[val]).flat()
      )
    )
  }

  function onStartRecord(): void {
    setIsRecording(true)
  }

  function onDataAvailable(event: BlobEvent): void {
    chunk.current.push(event.data)
  }

  function onStopRecord(): void {
    if (recordVideoEl.current === null) {
      return
    }

    const blob = new Blob(chunk.current, {
      type: 'video/mp4',
    })

    setRecordedUrl(URL.createObjectURL(blob))

    if (mediaRecorder.current !== null) {
      mediaRecorder.current.removeEventListener('start', onStartRecord)
      mediaRecorder.current.removeEventListener('stop', onStopRecord)
      mediaRecorder.current.removeEventListener(
        'dataavailable',
        onDataAvailable
      )

      mediaRecorder.current = null
    }

    setIsRecording(false)
  }

  function startRecord(): void {
    const stream = resultContext.current?.canvas?.captureStream(60)

    if (stream === undefined) {
      return
    }

    if (recordedUrl !== '') {
      URL.revokeObjectURL(recordedUrl)
    }
    setRecordedUrl('')
    chunk.current = []

    mediaRecorder.current = new MediaRecorder(stream)
    mediaRecorder.current.addEventListener('start', onStartRecord)
    mediaRecorder.current.addEventListener('stop', onStopRecord)
    mediaRecorder.current.addEventListener('dataavailable', onDataAvailable)

    mediaRecorder.current.start(1)
  }

  function stopRecord(): void {
    if (mediaRecorder.current === null) {
      return
    }

    mediaRecorder.current.stop()
  }

  function onRecordToggle(): void {
    if (isRecording) {
      stopRecord()
      return
    }

    startRecord()
  }

  function onClick(
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ): void {
    event.preventDefault()

    updateFaceSrc(
      videoEl.current,
      videoSize.current.width,
      videoSize.current.height
    ).catch(console.error)
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>): void {
    event.preventDefault()

    const file: File | undefined = event.target.files?.[0]
    const fileType: string | undefined = file?.type

    if (
      file === undefined ||
      fileType === undefined ||
      !fileType.startsWith('image/')
    ) {
      return
    }

    fileReader.current.readAsDataURL(file)
  }

  function onLoadFile(_event: Event): void {
    if (inputEl.current !== null) {
      inputEl.current.value = ''
    }

    if (typeof fileReader.current.result !== 'string') {
      return
    }

    loadImage(fileReader.current.result)
      .then((img: HTMLImageElement): void => {
        updateFaceSrc(img, img.naturalWidth, img.naturalHeight).catch(
          console.error
        )
      })
      .catch(console.error)
  }

  useEffect(() => {
    const fr = fileReader.current

    fr.addEventListener('load', onLoadFile)
    init().catch(console.error)

    return () => {
      fr.removeEventListener('load', onLoadFile)
    }
  }, [])

  return (
    <React.Fragment>
      <Head>
        <title>Media Recorder</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <canvas
        ref={faceSrcCanvas}
        className="fixed top-0 right-0 shadow-md"
        style={{
          maxWidth: '10vw',
        }}
      ></canvas>
      <div
        className="wrapper mr-4 ml-4 text-center"
        style={{ display: isReady ? '' : 'none' }}
      >
        <canvas
          ref={resultCanvas}
          className={[
            'mx-auto',
            'max-w-full',
            'block',
            'result',
            isRecording ? '-recording' : '',
          ].join(' ')}
        ></canvas>
        <div className="flex justify-center items-center mt-4">
          <input
            ref={inputEl}
            type="file"
            accept="image/*"
            onChange={onInputChange}
            className="border rounded"
          />
          <button
            ref={btnEl}
            onClick={onClick}
            type="button"
            className="border rounded py-1 px-2 bg-blue-500 text-white ml-4"
          >
            shoot
          </button>
        </div>
        <div className="my-6">
          <video
            ref={recordVideoEl}
            src={recordedUrl}
            controls
            className="mx-auto max-w-full"
            style={{
              display: recordedUrl === '' ? 'none' : '',
            }}
          ></video>
          <div className="text-center my-4">
            <button type="button" onClick={onRecordToggle}>
              <span
                className={[
                  'icon-record',
                  isRecording ? '-recording' : '',
                ].join(' ')}
              ></span>
              {isRecording ? 'stop' : 'start'} record
            </button>
          </div>
          {recordedUrl !== '' ? (
            <div className="text-center mt-4">
              <a
                href={recordedUrl}
                download={`record-${Date.now()}.mp4`}
                className="border rounded py-2 px-6 bg-green-500 text-white"
              >
                download movie file
              </a>
            </div>
          ) : (
            ''
          )}
        </div>
      </div>
      {isReady ? (
        ''
      ) : (
        <div className="loading fixed inset-0 bg-black bg-opacity-80"></div>
      )}
    </React.Fragment>
  )
}
