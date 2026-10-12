import { questionEmbeds } from '@/lib/questionEmbeds.mjs';

export function QuestionEmbeds({ text }) {
  const links = questionEmbeds(text);
  if (!links.length) return null;
  return (
    <div className="my-3 space-y-3 whitespace-normal">
      {links.map(link => (
        <section key={link.href} className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs">
            <span className="font-medium">{link.host}</span>
            <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">Open link in new tab ↗</a>
          </div>
          <iframe
            src={link.src}
            title={`Question resource from ${link.host}`}
            className={link.kind === 'video' ? 'block aspect-video w-full border-0' : 'block h-96 w-full border-0'}
            loading="lazy"
            sandbox={['www.youtube-nocookie.com', 'player.vimeo.com', 'drive.google.com'].includes(new URL(link.src).hostname)
              ? 'allow-scripts allow-same-origin allow-presentation'
              : 'allow-scripts allow-presentation'}
            referrerPolicy="no-referrer"
            allow="fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
          />
          <p className="px-4 py-2 text-xs text-muted-foreground">If the preview is unavailable, open the link above. Some sites require sign-in or do not allow embedding.</p>
        </section>
      ))}
    </div>
  );
}
