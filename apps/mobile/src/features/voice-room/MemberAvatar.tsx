import { useState } from 'react';
import { Image, type StyleProp, type ImageStyle } from 'react-native';
import maleAvatar from '../../../assets/profile/default-male.png';
import femaleAvatar from '../../../assets/profile/default-female.png';

export function MemberAvatar({
  url,
  style,
}: {
  url: string | null | undefined;
  style: StyleProp<ImageStyle>;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const fallback = url?.includes('variant=female') ? femaleAvatar : maleAvatar;
  return (
    <Image
      testID="room-member-avatar"
      source={url && failedUrl !== url ? { uri: url } : fallback}
      style={style}
      onError={() => setFailedUrl(url ?? null)}
    />
  );
}
