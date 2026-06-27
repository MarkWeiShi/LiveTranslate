import { useEffect, useRef, useState } from 'react';
import { Text, type TextStyle } from 'react-native';

// 逐字打字机（移植自 wolfcha useTypewriter）：挂载时把文本一字一字显示。
// 历史气泡只在首次挂载时打字一次（按稳定 key 复用，不重复播放）。
export function TypewriterText({ text, style, speed = 28 }: { text: string; style?: TextStyle | TextStyle[]; speed?: number }) {
  const [n, setN] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) { setN(text.length); return; }
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) { clearInterval(id); done.current = true; }
    }, speed);
    return () => clearInterval(id);
    // 仅按文本内容触发一次；同一气泡 text 稳定。
  }, [text, speed]);

  return <Text style={style}>{text.slice(0, n)}{n < text.length ? '▋' : ''}</Text>;
}
