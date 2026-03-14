import { cn } from "@/lib/utils";
import type { FlaggedContact } from "@/types";

/**
 * Deterministic avatar color from contact ID hash.
 * Keyed by ID — stable across renames. 6 iOS-style accent colors.
 */
const AVATAR_COLORS = [
  "bg-[#bf5af2]/15 text-[#bf5af2]",
  "bg-[#0a84ff]/15 text-[#0a84ff]",
  "bg-[#30d158]/15 text-[#30d158]",
  "bg-[#ff9f0a]/15 text-[#ff9f0a]",
  "bg-[#ff375f]/15 text-[#ff375f]",
  "bg-[#64d2ff]/15 text-[#64d2ff]",
] as const;

function contactColor(id: string): string {
  let sum = 0;
  for (const char of id) sum += char.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

const SIZE_CLASSES = {
  sm:   "h-8 w-8 text-[13px]",
  md:   "h-9 w-9 text-[14px]",
  lg:   "h-10 w-10 text-[15px]",
  xl:   "h-11 w-11 text-[16px]",
  "2xl": "h-16 w-16 text-2xl",
} as const;

type AvatarSize = keyof typeof SIZE_CLASSES;

interface ContactAvatarProps {
  contact: Pick<FlaggedContact, "id" | "name"> & { avatarUrl?: string };
  size?: AvatarSize;
  className?: string;
}

export function ContactAvatar({ contact, size = "md", className }: ContactAvatarProps) {
  const initial = contact.name.trim()[0]?.toUpperCase() ?? "?";

  if (contact.avatarUrl) {
    return (
      <img
        src={contact.avatarUrl}
        alt={contact.name}
        className={cn(
          "flex-shrink-0 rounded-full object-cover",
          SIZE_CLASSES[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-full font-semibold",
        SIZE_CLASSES[size],
        contactColor(contact.id),
        className
      )}
    >
      {initial}
    </div>
  );
}
