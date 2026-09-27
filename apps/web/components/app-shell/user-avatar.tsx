"use client";

import { useState } from "react";
import { cn } from "@repo/ui/utils";

type UserAvatarProps = {
  initials: string;
  avatarUrl?: string | null;
  className?: string;
  title?: string;
};

export function UserAvatar({ initials, avatarUrl, className, title }: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(avatarUrl) && failedUrl !== avatarUrl;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-[11px] font-semibold text-primary-foreground",
        className,
      )}
      title={title}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(avatarUrl ?? null)}
        />
      ) : (
        initials
      )}
    </div>
  );
}
