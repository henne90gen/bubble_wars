import { useRef, useEffect } from "react";

export default function Canvas(
  props: {
    draw: (ctx: CanvasRenderingContext2D, frameCount: number) => void;
  } & React.CanvasHTMLAttributes<HTMLCanvasElement>
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { draw } = props;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    const context = canvas.getContext("2d");
    if (context === null) {
      return;
    }
    let frameCount = 0;
    let animationFrameId = 0;

    const render = () => {
      frameCount++;
      draw(context, frameCount);
      animationFrameId = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [draw]);

  return <canvas ref={canvasRef} {...props} />;
}
