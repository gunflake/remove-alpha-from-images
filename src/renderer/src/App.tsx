import React, { useCallback, useRef, useState } from 'react'

interface ImageFile {
  file: File
  url: string
}

function App(): React.JSX.Element {
  const [images, setImages] = useState<ImageFile[]>([])
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 파일 드래그&드롭 핸들러
  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    const newFiles = files.map((file) => ({ file, url: URL.createObjectURL(file) }))
    setImages((prev) => [...prev, ...newFiles])
  }, [])

  // 파일 선택 핸들러
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files).filter((f) => f.type.startsWith('image/'))
    const newFiles = files.map((file) => ({ file, url: URL.createObjectURL(file) }))
    setImages((prev) => [...prev, ...newFiles])
  }

  // 파일 제거
  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx))
  }

  // 변환 버튼 클릭
  const onConvert = async () => {
    if (images.length === 0) return
    setProcessing(true)
    setMessage(null)
    try {
      // Electron API 유무 확인
      const api = (window as any).electron
      if (!api?.removeAlpha) {
        setMessage('Electron API가 없습니다')
        setProcessing(false)
        return
      }
      // 파일 목록을 main process로 전송 (path 또는 buffer)
      const files = await Promise.all(
        images.map(async (img) => {
          const name = img.file.name
          // @ts-ignore
          const filePath = (img.file as any).path
          if (filePath) {
            return { name, path: filePath }
          } else {
            const arrayBuffer = await img.file.arrayBuffer()
            return { name, data: arrayBuffer }
          }
        })
      )
      const result = await api.removeAlpha(files)
      setMessage(result.success ? '변환이 완료되었습니다!' : '변환 실패: ' + (result.error || ''))
    } catch (err: any) {
      setMessage('변환 중 오류 발생: ' + (err.message || err))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h2>Alpha 제거 PNG 변환기</h2>
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{ border: '2px dashed #aaa', padding: 40, textAlign: 'center', marginBottom: 20 }}
      >
        이미지를 드래그&드롭하거나{' '}
        <button onClick={() => inputRef.current?.click()}>파일 선택</button>
        <input
          type="file"
          accept="image/*"
          multiple
          ref={inputRef}
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
      </div>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {images.map((img, idx) => (
          <li key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <img
              src={img.url}
              alt="preview"
              style={{
                width: 48,
                height: 48,
                objectFit: 'cover',
                marginRight: 12,
                borderRadius: 4
              }}
            />
            <span style={{ flex: 1 }}>{img.file.name}</span>
            <button onClick={() => removeImage(idx)} style={{ marginLeft: 8 }}>
              삭제
            </button>
          </li>
        ))}
      </ul>
      <button
        disabled={processing || images.length === 0}
        onClick={onConvert}
        style={{ marginTop: 16, width: '100%', padding: 12, fontSize: 16 }}
      >
        {processing ? '변환 중...' : '변환'}
      </button>
      {message && (
        <div style={{ marginTop: 16, color: message.startsWith('변환이 완료') ? 'green' : 'red' }}>
          {message}
        </div>
      )}
    </div>
  )
}

export default App
