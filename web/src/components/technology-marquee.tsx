import { Marquee } from '@/components/ui/marquee';
const technologies = ['Python', 'LangChain', 'Groq', 'SQLAlchemy'];
export default function TechnologyMarquee() {
  return <section className="technology-marquee" aria-label="The engine underneath">
    <p className="technology-label">THE ENGINE UNDERNEATH</p>
    <Marquee duration={32} pauseOnHover fadeAmount={8}>
      {technologies.map(name => <span className="technology-item" key={name}><span aria-hidden="true" className="technology-separator"/>{name}</span>)}
    </Marquee>
  </section>;
}
