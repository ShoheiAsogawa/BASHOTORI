import { apiFetch } from './supabase';
import type { Photo } from '@/types';

// 画像をアップロード
export async function uploadImage(file: File, visitId: string): Promise<Photo> {
  const body = new FormData();
  body.append('file', file);
  body.append('visitId', visitId);
  const response = await apiFetch('/api/photos', { method: 'POST', body });
  return response.json() as Promise<Photo>;
}

// 画像を削除
export async function deleteImage(photo: Photo): Promise<void> {
  if (!photo.id || photo.url.includes('.supabase.co')) return;
  await apiFetch(`/api/photos/${encodeURIComponent(photo.id)}`, { method: 'DELETE' });
}

// 画像を圧縮
export async function compressImage(file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

