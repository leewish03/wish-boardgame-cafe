import { useEffect, useRef } from 'react';

export function zoomAt(view, point, factor, limits) {
  const w = Math.max(limits.min, Math.min(limits.max, view.w * factor));
  const ratio = w / view.w;
  return { x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio, w, h: view.h * ratio };
}

export default function useMapGestures(svgRef, view, setView, board) {
  const pointers = useRef(new Map()), previous = useRef(null), moved = useRef(false);
  useEffect(()=>{
    const cancel=()=>{pointers.current.clear();previous.current=null;moved.current=true;};
    window.addEventListener('blur',cancel);
    return()=>window.removeEventListener('blur',cancel);
  },[]);
  const sample = () => {
    const values = [...pointers.current.values()];
    if (!values.length) return null;
    const [a, b = a] = values;
    return { x:(a.x+b.x)/2, y:(a.y+b.y)/2, distance:Math.hypot(a.x-b.x,a.y-b.y), count:values.length };
  };
  const point = (x,y) => {
    const matrix = svgRef.current?.getScreenCTM();
    return matrix ? new window.DOMPoint(x,y).matrixTransform(matrix.inverse()) : null;
  };
  const limits = {min:board.width*.12,max:board.width*1.3};
  const stop = e => {
    pointers.current.delete(e.pointerId);
    previous.current=sample();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  return { moved, handlers: {
    onPointerDown:e=>{
      if(e.button!==0)return;
      if(!pointers.current.size)moved.current=false;
      pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.current.size>1)moved.current=true;
      previous.current=sample();
    },
    onPointerMove:e=>{
      if(!pointers.current.has(e.pointerId))return;
      const before=previous.current;
      pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      const next=sample();
      if(!before||!next)return;
      if(!moved.current&&next.count===1&&Math.hypot(next.x-before.x,next.y-before.y)<5)return;
      moved.current=true;
      e.currentTarget.setPointerCapture(e.pointerId);
      const from=point(before.x,before.y),to=point(next.x,next.y);
      if(from&&to){
        setView(current=>{
          const translated={...current,x:current.x+from.x-to.x,y:current.y+from.y-to.y};
          return next.count===2&&before.distance>0&&next.distance>0?zoomAt(translated,from,before.distance/next.distance,limits):translated;
        });
      }
      previous.current=next;
    },
    onPointerUp:stop,
    onPointerLeave:e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))stop(e);},
    onPointerCancel:e=>{moved.current=true;stop(e);},
    onLostPointerCapture:e=>{pointers.current.delete(e.pointerId);previous.current=sample();},
    onWheel:e=>{
      const anchor=point(e.clientX,e.clientY);
      if(anchor)setView(zoomAt(view,anchor,Math.exp(Math.max(-200,Math.min(200,e.deltaY))*.002),limits));
    },
  }};
}
