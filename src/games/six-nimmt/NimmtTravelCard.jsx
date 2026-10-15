import React, { useLayoutEffect, useRef, useState } from 'react';
import { animate, useMotionValue } from 'framer-motion';
import Card from './NimmtCard';

export function createNimmtFlight({from,duration,now,animate:run,onUpdate,onComplete}) {
  let current={...from},target,control,deadline,generation=0,disposed=false,finished=false;
  const publish=box=>{current=box;onUpdate(box);};
  return {
    retarget(next){
      if(disposed||target&&Object.keys(next).every(key=>next[key]===target[key]))return;
      if(finished){target={...next};publish(target);return;}
      const token=++generation;
      control?.stop();
      target={...next};
      const start={...current},end={...next};
      deadline??=now()+duration;
      control=run(0,1,{duration:Math.max(0,deadline-now())/1000,ease:'easeInOut',
        onUpdate:progress=>{
          if(disposed||finished||token!==generation)return;
          publish(Object.fromEntries(Object.keys(end).map(key=>[key,start[key]+(end[key]-start[key])*progress])));
        },
        onComplete:()=>{
          if(disposed||finished||token!==generation)return;
          finished=true;publish(end);onComplete();
        },
      });
    },
    dispose(){disposed=true;++generation;control?.stop();},
  };
}

export default function NimmtTravelCard({card,source,reduce=false,onComplete,style}) {
  const anchor=useRef(null),complete=useRef(onComplete),[base,setBase]=useState(source);
  complete.current=onComplete;
  const x=useMotionValue(source?.left??0),y=useMotionValue(source?.top??0);
  const scaleX=useMotionValue(1),scaleY=useMotionValue(1);
  const scale=Number(style?.scale??1);
  useLayoutEffect(()=>{
    const node=anchor.current;
    if(!node)return;
    const read=()=>{
      const {left,top,width,height}=node.getBoundingClientRect();
      return {left:left+width*(1-scale),top:top+height*(1-scale),width:width*scale,height:height*scale};
    };
    const destination=read(),from=source??destination;
    setBase(from);x.set(from.left);y.set(from.top);scaleX.set(1);scaleY.set(1);
    const flight=createNimmtFlight({from,duration:reduce?10:380,now:()=>window.performance.now(),animate,
      onUpdate:box=>{x.set(box.left);y.set(box.top);scaleX.set(box.width/from.width);scaleY.set(box.height/from.height);},
      onComplete:()=>complete.current?.(),
    });
    const measure=()=>flight.retarget(read());
    flight.retarget(destination);
    const resize=new window.ResizeObserver(measure);
    resize.observe(node);
    window.addEventListener('resize',measure);
    window.addEventListener('scroll',measure,true);
    return()=>{flight.dispose();resize.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
  },[source,reduce,scale,x,y,scaleX,scaleY]);
  return <span ref={anchor} style={{display:'block',width:'var(--card-w)',height:'var(--card-h)'}}>
    <Card card={card} reduce={reduce} layout={false} style={{position:'fixed',left:0,top:0,width:base?.width,height:base?.height,x,y,scaleX,scaleY,originX:0,originY:0,zIndex:30,pointerEvents:'none',visibility:base?'visible':'hidden'}}/>
  </span>;
}
