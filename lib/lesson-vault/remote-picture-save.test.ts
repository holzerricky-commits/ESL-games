import { describe, expect, it } from 'vitest'
import { decideRemotePictureSave } from './remote-picture-save'

const remote = 'https://cdn.example.com/feather.jpg'
const local = '/api/local-data/lesson-vault/picture?studentId=stu_a&cardId=card-1&v=1'
const teacher = '/api/local-data/lesson-vault/picture?studentId=stu_a&cardId=card-1&v=2'

describe('decideRemotePictureSave', () => {
  it('applies the downloaded file when the card still shows the url we started from', () => {
    expect(
      decideRemotePictureSave({
        beforeUrl: remote,
        nowUrl: remote,
        uploadedUrl: local,
        requestedUrl: remote,
      }),
    ).toEqual({ action: 'apply', url: local })
  })

  it('keeps a picture the teacher attached while the web picture was downloading', () => {
    expect(
      decideRemotePictureSave({
        beforeUrl: remote,
        nowUrl: teacher,
        uploadedUrl: null,
        requestedUrl: remote,
      }),
    ).toEqual({ action: 'keep' })
    expect(
      decideRemotePictureSave({
        beforeUrl: '',
        nowUrl: teacher,
        uploadedUrl: local,
        requestedUrl: remote,
      }),
    ).toEqual({ action: 'keep' })
  })

  it('keeps the remote link when the download did not write a file and the card is unchanged', () => {
    expect(
      decideRemotePictureSave({
        beforeUrl: remote,
        nowUrl: remote,
        uploadedUrl: null,
        requestedUrl: remote,
      }),
    ).toEqual({ action: 'apply', url: remote })
  })

  it('replaces the previous picture when the teacher asked for a new web picture and did not change it again', () => {
    expect(
      decideRemotePictureSave({
        beforeUrl: teacher,
        nowUrl: teacher,
        uploadedUrl: local,
        requestedUrl: remote,
      }),
    ).toEqual({ action: 'apply', url: local })
  })
})
