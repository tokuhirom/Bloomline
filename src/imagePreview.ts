export function extractImageUrls(text: string): string[] {
  const re = /https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|svg|bmp|avif)(\?\S*)?/gi;
  return [...text.matchAll(re)].map(m => m[0]);
}

export function refreshImagePreview(container: HTMLElement, text: string): void {
  container.innerHTML = '';
  const urls = extractImageUrls(text);
  urls.forEach(url => {
    const img = document.createElement('img');
    img.className = 'node-image-preview';
    img.src = url;
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('click', () => window.open(url, '_blank'));
    img.addEventListener('error', () => img.remove());
    container.appendChild(img);
  });
}
