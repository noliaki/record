import Head from 'next/head'
import React, { useState, useRef, useCallback } from 'react'
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
  DirectionalLight,
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
  const geometry = useRef<BufferGeometry | null>(null)
  const attribute = useRef<BufferAttribute | null>(null)
  const material = useRef<MeshBasicMaterial | null>(null)
  const mesh = useRef<Mesh | null>(null)
  const imgEl = useRef<HTMLImageElement | null>(null)

  const modelSize = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })
  const modelCanvas = useRef<HTMLCanvasElement | null>(null)
  const modelContext = useRef<CanvasRenderingContext2D | null>(null)

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
  }

  function createScene(): void {
    if (rendererEl.current === null) {
      return
    }

    renderer.current = new WebGLRenderer({
      canvas: rendererEl.current,
    })
    scene.current = new Scene()
    camera.current = new PerspectiveCamera(45, 560 / 960)
    camera.current.position.z = 1000
    camera.current.lookAt(0, 0, 0)

    geometry.current = new BufferGeometry()
    attribute.current = new BufferAttribute(new Float32Array([]), 3)
    geometry.current.setAttribute('position', attribute.current)
    material.current = new MeshBasicMaterial({
      color: 0x00aaff,
      wireframe: true,
    })
    mesh.current = new Mesh(geometry.current, material.current)
    scene.current.add(mesh.current)

    const directionalLight = new DirectionalLight(0xffffff)
    directionalLight.position.set(1, 1, 1)
    scene.current.add(directionalLight)

    render()
  }

  function render(): void {
    if (
      renderer.current === null ||
      scene.current === null ||
      camera.current === null
    ) {
      return
    }

    if (predictions.current !== null) {
      attribute.current = new BufferAttribute(
        new Float32Array(
          ((predictions.current[0] as any).mesh as Array<
            [number, number, number]
          >).flat() ?? []
        ),
        3
      )
      console.log(predictions.current)
      attribute.current.needsUpdate = true
      if (geometry.current !== null) {
        geometry.current.setAttribute('position', attribute.current)
      }
    }

    renderer.current.render(scene.current, camera.current)

    rafId.current = requestAnimationFrame(() => {
      render()
    })
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
