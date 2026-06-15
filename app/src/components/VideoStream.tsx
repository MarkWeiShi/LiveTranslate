import { CSSProperties, useEffect, useRef } from 'react';

// Web-only: renders a MediaStream into an HTML <video>. On Expo web the reconciler is
// react-dom, so a raw <video> renders correctly inside the RN view tree.
export function VideoStream({
  stream,
  muted,
  mirror,
  volume = 1,
  radius = 0,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  volume?: number;
  radius?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume]);

  const style: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: radius,
    transform: mirror ? 'scaleX(-1)' : undefined,
    backgroundColor: '#000',
  };

  return <video ref={ref} autoPlay playsInline muted={muted} style={style} />;
}
