import Head from 'next/head'
import dynamic from 'next/dynamic'
import React from 'react'

const VideoRecord = dynamic(
  async () => await import('../components/VideoRecord'),
  {
    ssr: false,
  }
)

export default function Home(): JSX.Element {
  return (
    <React.Fragment>
      <Head>
        <title>Media Recorder</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <VideoRecord />
    </React.Fragment>
  )
}
