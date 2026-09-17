const backendOrigin = 'http://localhost:3000';

export function resolveMediaUrl(path: string | null | undefined): string {
  if (!path) {
    return '';
  }

  if (
    path.startsWith('blob:') ||
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('data:')
  ) {
    return path;
  }

  if (path.startsWith('/uploads/')) {
    return `${backendOrigin}${path}`;
  }

  return path;
}
