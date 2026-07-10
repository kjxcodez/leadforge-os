import { Avatar, AvatarFallback, AvatarImage } from './avatar';

// ---------------------------------------------------------------------------
// UserAvatar
// ---------------------------------------------------------------------------

interface UserAvatarProps {
  initials?: string;
  src?: string;
  size?: 'sm' | 'default' | 'lg';
  alt?: string;
}

/**
 * UserAvatar wraps the shadcn Avatar primitive with initials fallback
 * for quick user identification across the app shell.
 */
export function UserAvatar({ initials = '?', src, size = 'default', alt = 'User' }: UserAvatarProps) {
  return (
    <Avatar size={size}>
      {src && <AvatarImage src={src} alt={alt} />}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
