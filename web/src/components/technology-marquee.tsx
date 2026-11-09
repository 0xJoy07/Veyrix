import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Marquee } from '@/components/ui/marquee';
const technologies = ['Python', 'LangChain', 'Groq', 'SQLAlchemy'];
export default function TechnologyMarquee() {
  const [paused, setPaused] = useState(false);
  return <section className="technology-marquee" aria-label="The engine underneath">
    <p className="technology-label">THE ENGINE UNDERNEATH</p>
    <Marquee duration={32} pauseOnHover paused={paused} fadeAmount={8}>
      {technologies.map(name => <span className="technology-item" key={name}><span aria-hidden="true" className="technology-separator"/>{name}</span>)}
    </Marquee>
    <button type="button" className="technology-motion-button" aria-label={paused ? 'Play technology marquee' : 'Pause technology marquee'} onClick={() => setPaused(value => !value)}>{paused ? <Play size={14} aria-hidden="true"/> : <Pause size={14} aria-hidden="true"/>}</button>
  </section>;
}
