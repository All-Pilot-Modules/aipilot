// Only web URLs are eligible; never interpret teacher input as executable HTML.
export function questionEmbeds(text) {
  const prose = String(text || '').replace(/```[\s\S]*?```|`[^`]*`/g, '');
  const matches = prose.match(/https?:\/\/[^\s<>"\]]+/g) || [];
  const seen = new Set();
  return matches.flatMap(value => {
    let raw = value.replace(/[.,;!?:]+$/, '');
    while (raw.endsWith(')') && (raw.match(/\)/g) || []).length > (raw.match(/\(/g) || []).length) raw = raw.slice(0, -1);
    try {
      const url = new URL(raw);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return [];
      if (seen.has(url.href)) return [];
      seen.add(url.href);
      let src = url.href;
      let kind = 'page';
      const host = url.hostname.replace(/^www\./, '');
      if (['youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) {
        const id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
        if (/^[\w-]{11}$/.test(id || '')) {
          src = `https://www.youtube-nocookie.com/embed/${id}`;
          kind = 'video';
        }
      } else if (host === 'vimeo.com' && /^\/\d+$/.test(url.pathname)) {
        src = `https://player.vimeo.com/video${url.pathname}`;
        kind = 'video';
      } else if (host === 'drive.google.com' && /^\/file\/d\/[^/]+/.test(url.pathname)) {
        src = `https://drive.google.com${url.pathname.match(/^\/file\/d\/[^/]+/)[0]}/preview`;
      }
      return [{ href: url.href, src, kind, host }];
    } catch { return []; }
  });
}
