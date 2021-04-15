import Head from 'next/head'
import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  load,
  SupportedPackages,
  FaceLandmarksPrediction,
  // FaceLandmarksPackage,
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
  DirectionalLight,
  CanvasTexture,
  DoubleSide,
} from 'three'
import { TRIANGULATION } from '../utils/triangulation'
import { loadImage } from '../utils/loadImage'

export default function VideoRecord(): JSX.Element {
  const chunk = useRef<Blob[]>([])
  const videoEl = useRef<HTMLVideoElement | null>(null)
  const recordVideoEl = useRef<HTMLVideoElement | null>(null)
  const btnEl = useRef<HTMLButtonElement | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const predictions = useRef<FaceLandmarksPrediction[] | null>(null)
  const rendererEl = useRef<HTMLCanvasElement | null>(null)
  const renderer = useRef<WebGLRenderer | null>(null)
  const scene = useRef<Scene | null>(null)
  const camera = useRef<PerspectiveCamera | null>(null)
  const rafId = useRef<number | undefined>(undefined)
  const attribute = useRef<BufferAttribute | null>(null)
  const geometry = useRef<BufferGeometry | null>(null)
  const material = useRef<MeshBasicMaterial | null>(null)
  const mesh = useRef<Mesh | null>(null)
  const imgEl = useRef<HTMLImageElement | null>(null)
  const model = useRef<any | null>(null)

  const modelSize = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })
  const modelCanvas = useRef<HTMLCanvasElement | null>(null)
  const modelContext = useRef<CanvasRenderingContext2D | null>(null)

  async function init(): Promise<void> {
    model.current = await load(SupportedPackages.mediapipeFacemesh)

    createScene()

    await createModel()
    await startVideo()

    await render()
  }

  async function createModel(): Promise<void> {
    const modelImage = await loadImage('./ojin.jpg')
    const width = modelImage.naturalWidth
    const height = modelImage.naturalHeight

    if (modelCanvas.current === null) {
      return
    }

    modelCanvas.current.width = width
    modelCanvas.current.height = height

    modelContext.current = modelCanvas.current.getContext('2d')

    if (modelContext.current === null) {
      return
    }

    modelContext.current.drawImage(modelImage, 0, 0)

    modelSize.current = {
      width,
      height,
    }

    const [prediction] = (await model.current.estimateFaces({
      input: modelCanvas.current,
    })) as Array<
      FaceLandmarksPrediction & {
        scaledMesh: Array<[number, number, number]>
      }
    >

    const texture = new CanvasTexture(modelCanvas.current)
    texture.flipY = false

    const position = new Float32Array(
      TRIANGULATION.map((val: number) => prediction.scaledMesh[val]).flat()
    )

    const uv = new Float32Array(
      TRIANGULATION.map((val: number) => [
        prediction.scaledMesh[val][0] / width,
        prediction.scaledMesh[val][1] / height,
      ]).flat()
    )

    mesh.current = new Mesh()

    mesh.current.geometry = new BufferGeometry()
    mesh.current.geometry.setAttribute(
      'position',
      new BufferAttribute(position, 3)
    )
    mesh.current.geometry.setAttribute('uv', new BufferAttribute(uv, 2))

    mesh.current.material = new MeshBasicMaterial({
      map: texture,
      side: DoubleSide,
    })

    mesh.current.rotation.set(Math.PI, Math.PI, 0)

    if (scene.current !== null) {
      scene.current.add(mesh.current)
    }

    // const position = TRIANGULATION.map((i: number) => prediction.sclaedMesh)
  }

  function updatePosition(position: Float32Array): void {
    if (mesh.current === null) {
      return
    }

    const arr = mesh.current.geometry.attributes.position.array

    for (let i = 0; i < arr.length / 3; i++) {
      mesh.current.geometry.attributes.position.setXYZ(
        i,
        position[i * 3 + 0],
        position[i * 3 + 1],
        position[i * 3 + 2]
      )
    }

    mesh.current.geometry.attributes.position.needsUpdate = true
  }

  async function startVideo(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
    })

    if (videoEl.current === null || typeof videoEl.current === 'undefined') {
      return
    }

    videoEl.current.srcObject = stream
    await videoEl.current.play().catch(console.error)

    if (rendererEl.current === null) {
      return
    }

    rendererEl.current.width = videoEl.current.videoWidth
    rendererEl.current.height = videoEl.current.videoHeight
  }

  function createScene(): void {
    if (rendererEl.current === null) {
      return
    }

    renderer.current = new WebGLRenderer({
      canvas: rendererEl.current,
    })
    renderer.current.setClearColor(0xffffff)

    scene.current = new Scene()
    camera.current = new PerspectiveCamera(1, 560 / 960, 1)
    camera.current.position.z = 100
    // camera.current.lookAt(0, 0, 0)

    // geometry.current = new BufferGeometry()
    // attribute.current = new BufferAttribute(new Float32Array([]), 3)
    // geometry.current.setAttribute('position', attribute.current)
    // material.current = new MeshBasicMaterial({
    //   color: 0x00aaff,
    //   wireframe: true,
    // })
    // mesh.current = new Mesh(geometry.current, material.current)
    // scene.current.add(mesh.current)

    // const directionalLight = new DirectionalLight(0xffffff)
    // directionalLight.position.set(1, 1, 1)
    // scene.current.add(directionalLight)

    // render().catch(console.error)
  }

  async function render(): Promise<void> {
    if (
      renderer.current === null ||
      scene.current === null ||
      camera.current === null
    ) {
      return
    }

    // if (predictions.current !== null) {
    //   attribute.current = new BufferAttribute(
    //     new Float32Array(
    //       ((predictions.current[0] as any).mesh as Array<
    //         [number, number, number]
    //       >).flat() ?? []
    //     ),
    //     3
    //   )
    //   console.log(predictions.current)
    //   attribute.current.needsUpdate = true
    //   if (geometry.current !== null) {
    //     geometry.current.setAttribute('position', attribute.current)
    //   }
    // }

    await estimateAndUpdateFromVideo().catch(console.error)

    renderer.current.render(scene.current, camera.current)

    rafId.current = requestAnimationFrame(() => {
      render().catch(console.error)
    })
  }

  async function estimateAndUpdateFromVideo(): Promise<void> {
    const [prediction] = (await model.current.estimateFaces({
      input: videoEl.current,
    })) as Array<
      FaceLandmarksPrediction & {
        scaledMesh: Array<[number, number, number]>
      }
    >

    updatePosition(
      new Float32Array(
        TRIANGULATION.map((val: number) => prediction.scaledMesh[val]).flat()
      )
    )
  }

  const onStartRecord = useCallback(() => {
    console.log('on start recort')

    createScene()
  }, [])

  const onDataAvailable = useCallback((event: BlobEvent): void => {
    chunk.current.push(event.data)
  }, [])

  const onStopRecord = useCallback(() => {
    const blob = new Blob(chunk.current, {
      type: 'video/mp4',
    })
    const videoUrl = URL.createObjectURL(blob)

    if (recordVideoEl.current === null) return

    recordVideoEl.current.src = videoUrl
    recordVideoEl.current.controls = true
  }, [])

  async function startPlayAndRecord(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
    })

    if (videoEl.current === null || typeof videoEl.current === 'undefined') {
      return
    }

    const model = await load(SupportedPackages.mediapipeFacemesh)
    videoEl.current.srcObject = stream
    await videoEl.current.play().catch(console.error)

    mediaRecorder.current = new MediaRecorder(stream)
    mediaRecorder.current.addEventListener('start', onStartRecord)
    mediaRecorder.current.addEventListener('stop', onStopRecord)
    mediaRecorder.current.addEventListener('dataavailable', onDataAvailable)

    chunk.current = []
    mediaRecorder.current.start(1)

    if (rendererEl.current !== null) {
      rendererEl.current.width = videoEl.current.videoWidth
      rendererEl.current.height = videoEl.current.videoHeight
    }

    predictions.current = await model.estimateFaces({
      input: videoEl.current,
    })
  }

  function stopPlayAndRecord(): void {
    if (videoEl.current === null || mediaRecorder.current === null) {
      return
    }

    videoEl.current.pause()
    mediaRecorder.current.stop()
  }

  const onClick = (): void => {
    console.log(chunk.current)

    if (videoEl.current?.paused === true) {
      startPlayAndRecord().catch(console.error)
    } else {
      stopPlayAndRecord()
    }
  }

  useEffect(() => {
    init().catch(console.error)
  }, [])

  return (
    <React.Fragment>
      <Head>
        <title>Media Recorder</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <canvas ref={modelCanvas}></canvas>
      <video ref={videoEl} src=""></video>
      <button ref={btnEl} onClick={onClick} type="button">
        ほげ
      </button>
      <canvas ref={rendererEl}></canvas>
      <video ref={recordVideoEl} src=""></video>
    </React.Fragment>
  )
}
