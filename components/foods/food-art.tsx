/* eslint-disable @next/next/no-img-element */

/**
 * A food's face: generated character artwork when ready, otherwise its
 * emoji placeholder. Artwork failure never blocks anything — the emoji is
 * always there.
 */
export function FoodArt({
  name,
  emoji,
  iconUrl,
  className = "",
  emojiClassName = "",
}: {
  name: string;
  emoji: string;
  iconUrl: string | null;
  className?: string;
  emojiClassName?: string;
}) {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        loading="lazy"
        className={`pointer-events-none select-none object-contain ${className}`}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      className={`pointer-events-none select-none leading-none ${emojiClassName}`}
    >
      {emoji}
    </span>
  );
}
