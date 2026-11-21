/** URL of a service photo. <img> tags cannot send headers, so the token goes in the query string (same as documents). */
export function photoUrl(photoId: number, token: string | null): string {
  return `/api/service-photos/${photoId}/file?token=${encodeURIComponent(token || '')}`;
}

/** Shrink a picked image to max 1600px JPEG before upload, so pages stay fast on phones. */
export function resizeImage(file: File, max = 1600, quality = 0.85): Promise<{ mime_type: string; data_base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error(`${file.name} is not a readable image`));
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        const ctx = c.getContext('2d');
        if (!ctx) return resolve({ mime_type: file.type || 'image/jpeg', data_base64: String(reader.result) });
        ctx.fillStyle = '#fff'; // transparent PNGs get a white background in JPEG
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve({ mime_type: 'image/jpeg', data_base64: c.toDataURL('image/jpeg', quality) });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** Company logo: kept as PNG so a transparent background stays transparent; at most 512 px. */
export function resizeLogo(file: File, max = 512): Promise<{ mime_type: string; data_base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error(`${file.name} is not a readable image`));
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * s));
        c.height = Math.max(1, Math.round(img.height * s));
        const ctx = c.getContext('2d');
        if (!ctx) return resolve({ mime_type: file.type || 'image/png', data_base64: String(reader.result) });
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve({ mime_type: 'image/png', data_base64: c.toDataURL('image/png') });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const OTHER_HEADING = 'Other';

/** Group items under their heading, keeping the order in which headings first appear. */
export function groupByCategory<T extends { category?: string | null }>(list: T[]): { name: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const it of list) {
    const k = it.category || OTHER_HEADING;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(it);
  }
  return [...groups].map(([name, items]) => ({ name, items }));
}

// ---------- Video links (YouTube / Instagram) ----------
export interface VideoRef { provider: 'file' | 'youtube' | 'instagram'; video_id: string | null; }

const YT_ID = /^[\w-]{11}$/;
const IG_ID = /^(p|reel|tv)\/[\w-]{5,40}$/;

/** Player address built only from a checked id, never from a pasted link. Null if the id looks wrong. */
export function videoEmbedUrl(v: VideoRef): string | null {
  if (!v.video_id) return null;
  if (v.provider === 'youtube' && YT_ID.test(v.video_id)) return `https://www.youtube-nocookie.com/embed/${v.video_id}?autoplay=1&rel=0&playsinline=1`;
  if (v.provider === 'instagram' && IG_ID.test(v.video_id)) return `https://www.instagram.com/${v.video_id}/embed`;
  return null;
}

/** Preview picture (YouTube only; Instagram gives none without a login). */
export function videoThumb(v: VideoRef): string | null {
  return v.provider === 'youtube' && !!v.video_id && YT_ID.test(v.video_id) ? `https://i.ytimg.com/vi/${v.video_id}/hqdefault.jpg` : null;
}

/** Uploaded video file address (logged-in panel adds the token; booking pages use the public path). */
export function videoFileUrl(videoId: number, token: string | null, publicBase?: string): string {
  return publicBase ? `/api${publicBase}/service-videos/${videoId}/file` : `/api/service-videos/${videoId}/file?token=${encodeURIComponent(token || '')}`;
}
