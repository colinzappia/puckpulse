
import { useEffect } from 'react';

/**
 * Sets document.title and the meta description tag for the current page.
 * Each standalone route (About, Manual, Contact, Advertise) calls this so
 * Google — and anyone sharing a link — sees distinct, accurate info per
 * page instead of the same generic homepage title everywhere.
 */
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    let meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute('content') ?? '';
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', description);

    return () => {
      document.title = previousTitle;
      meta?.setAttribute('content', previousDescription);
    };
  }, [title, description]);
}

