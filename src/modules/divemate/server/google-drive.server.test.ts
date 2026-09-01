import { describe, expect, test } from 'bun:test'
import {
  drivePathBasename,
  findDriveFile,
  type GoogleDriveFile,
} from './google-drive.server'

const files: GoogleDriveFile[] = [
  {
    id: 'media',
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
    path: '/Media/photo.jpg',
    size: 10,
  },
  {
    id: 'archive',
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
    path: '/Archive/photo.jpg',
    size: 10,
  },
]

describe('Google Drive DiveMate file matching', () => {
  test('extracts names from Android and Windows paths', () => {
    expect(drivePathBasename('/storage/emulated/0/DiveMate/Media/photo.jpg')).toBe(
      'photo.jpg',
    )
    expect(drivePathBasename('DiveMate\\Media\\front.png')).toBe('front.png')
  })

  test('prefers the expected folder when duplicate names exist', () => {
    expect(findDriveFile(files, '/old/path/photo.jpg', 'Media')?.id).toBe('media')
  })

  test('uses deterministic path ordering without a preferred folder', () => {
    expect(findDriveFile(files, '/old/path/photo.jpg')?.id).toBe('archive')
  })

  test('matches file names case-insensitively', () => {
    expect(findDriveFile(files, '/old/path/PHOTO.JPG', 'Media')?.id).toBe('media')
  })
})
