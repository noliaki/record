import Head from 'next/head'
import React, { useState, useRef, useCallback } from 'react'

export default function VideoRecord(): JSX.Element {
  const chunk = useRef<Blob[]>([])
  const videoEl = useRef<HTMLVideoElement | null>(null)
  const recordVideoEl = useRef<HTMLVideoElement | null>(null)
  const btnEl = useRef<HTMLButtonElement | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)

  const onStartRecord = useCallback(() => {
    console.log('on start recort')
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

    videoEl.current.srcObject = stream
    await videoEl.current.play().catch(console.error)

    mediaRecorder.current = new MediaRecorder(stream)
    mediaRecorder.current.addEventListener('start', onStartRecord)
    mediaRecorder.current.addEventListener('stop', onStopRecord)
    mediaRecorder.current.addEventListener('dataavailable', onDataAvailable)

    chunk.current = []
    mediaRecorder.current.start(1)
  }

  function stopPlayAndRecord(): void {
    if (videoEl.current === null || mediaRecorder.current === null) {
      return
    }

    videoEl.current.pause()
    mediaRecorder.current.stop()
  }

  const onClick = useCallback((): void => {
    console.log(chunk.current)

    if (videoEl.current?.paused === true) {
      startPlayAndRecord().catch(console.error)
    } else {
      stopPlayAndRecord()
    }
  }, [])

  return (
    <React.Fragment>
      <Head>
        <title>Media Recorder</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <video ref={videoEl} src=""></video>
      <button ref={btnEl} onClick={onClick} type="button">
        ほげ
      </button>
      <video ref={recordVideoEl} src=""></video>
    </React.Fragment>
  )
}
