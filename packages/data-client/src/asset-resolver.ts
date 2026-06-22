import { DataClientError } from './errors';

export interface AssetResolverOptions {
  readonly baseUrl: string | URL;
  readonly allowedHosts?: readonly string[];
}

export function resolveAssetUrl(href: string, options: AssetResolverOptions): URL {
  if (href.trim() === '') {
    throw new DataClientError({
      code: 'ASSET_NOT_FOUND',
      message: 'Asset href must not be empty.',
    });
  }

  if (hasForbiddenScheme(href)) {
    throw new DataClientError({
      code: 'HOST_NOT_ALLOWED',
      message: `Asset href uses a forbidden scheme: ${href}`,
    });
  }

  if (containsPathTraversal(href)) {
    throw new DataClientError({
      code: 'ASSET_NOT_FOUND',
      message: `Asset href must not contain path traversal: ${href}`,
    });
  }

  const baseUrl = new URL(options.baseUrl);
  const resolved = new URL(href, baseUrl);

  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
    throw new DataClientError({
      code: 'HOST_NOT_ALLOWED',
      message: `Asset URL protocol is not allowed: ${resolved.protocol}`,
      url: resolved.toString(),
    });
  }

  const allowedHosts = options.allowedHosts ?? [baseUrl.host];
  if (!allowedHosts.includes(resolved.host) && !allowedHosts.includes(resolved.hostname)) {
    throw new DataClientError({
      code: 'HOST_NOT_ALLOWED',
      message: `Asset host is not allowed: ${resolved.host}`,
      url: resolved.toString(),
    });
  }

  return resolved;
}

function hasForbiddenScheme(href: string): boolean {
  return (
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(href) &&
    !href.startsWith('http:') &&
    !href.startsWith('https:')
  );
}

function containsPathTraversal(href: string): boolean {
  const withoutQuery = href.split(/[?#]/, 1)[0] ?? '';
  const normalizedSeparators = withoutQuery.replaceAll('\\', '/');
  return normalizedSeparators
    .split('/')
    .map((part) => safeDecode(part))
    .some((part) => part === '..');
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
