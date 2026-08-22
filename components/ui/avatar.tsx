const AVATAR_COLORS: Record<string, { bg: string; text: string }> = {
  broccoli: { bg: "bg-broccoli", text: "text-white" },
  tomato: { bg: "bg-tomato", text: "text-white" },
  blueberry: { bg: "bg-blueberry", text: "text-white" },
  carrot: { bg: "bg-carrot", text: "text-white" },
  custard: { bg: "bg-custard", text: "text-ink" },
  plum: { bg: "bg-pink-500", text: "text-white" },
};

const SIZES = {
  sm: "size-7 text-xs border-2",
  md: "size-10 text-sm border-[2.5px]",
  lg: "size-14 text-lg border-[3px]",
  xl: "size-24 text-3xl border-4",
} as const;

export function Avatar({
  name,
  style,
  size = "md",
  className = "",
}: {
  name: string;
  style: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const colors = AVATAR_COLORS[style] ?? AVATAR_COLORS.broccoli;
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-ink font-display ${colors.bg} ${colors.text} ${SIZES[size]} ${className}`}
    >
      {initials}
    </span>
  );
}
