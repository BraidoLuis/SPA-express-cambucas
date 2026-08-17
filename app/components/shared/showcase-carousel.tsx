"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getActiveShowcase, showcaseAlt, type ShowcaseMedia } from "../../lib/services/showcase-media-service";

export function ShowcaseCarousel({compact=false}:{compact?:boolean}){
  const [items,setItems]=useState<ShowcaseMedia[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");const track=useRef<HTMLDivElement>(null);
  useEffect(()=>{let active=true;getActiveShowcase().then(data=>{if(active)setItems(data);}).catch(()=>{if(active)setError("Não foi possível carregar a vitrine.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  if(loading)return <div className="showcase-feedback">Carregando inspirações...</div>;
  if(error)return <div className="showcase-feedback error">{error}</div>;
  if(!items.length)return <div className="showcase-feedback">Nenhum conteúdo ativo na vitrine no momento.</div>;
  return <section className={`client-media-showcase showcase-section ${compact?"compact":""}`}><div className="client-media-heading"><div><span className="eyebrow">INSPIRAÇÕES DO SPA</span><h2>Veja nossos cuidados de perto</h2><p>Novidades publicadas pela equipe para inspirar seu próximo momento.</p></div><div className="carousel-arrows"><button className="icon-button" aria-label="Conteúdo anterior" title="Conteúdo anterior" onClick={()=>track.current?.scrollBy({left:-380,behavior:"smooth"})}><ChevronLeft aria-hidden="true"/></button><button className="icon-button" aria-label="Próximo conteúdo" title="Próximo conteúdo" onClick={()=>track.current?.scrollBy({left:380,behavior:"smooth"})}><ChevronRight aria-hidden="true"/></button></div></div><div className="client-media-carousel" ref={track}>{items.map(item=><article key={item.id}><div className="client-media-asset">{item.type==="video"?<video src={item.url||""} controls playsInline preload="metadata"/>:<img src={item.url||""} alt={showcaseAlt(item)} loading="lazy"/>}{item.professionalName&&<span>{item.professionalName}</span>}</div><div>{item.serviceName&&<small>{item.serviceName}</small>}<h3>{item.title}</h3>{item.caption&&<p>{item.caption}</p>}</div></article>)}</div></section>;
}
