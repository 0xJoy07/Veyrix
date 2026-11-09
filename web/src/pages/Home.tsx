import { FeaturesSectionWithHoverEffects } from '@/components/ui/feature-section-with-hover-effects';
import TechnologyMarquee from '@/components/technology-marquee';
import DotField from '@/components/ui/dot-field';
import { AntiMetalLink } from '@/components/ui/anti-metal-button';
import DimensionalWorkflowHero from '@/components/ui/dimensional-workflow-hero';
import { heroContent } from '@/content/hero';
export default function Home() { return <>
  <DimensionalWorkflowHero
    className="veyrix-home"
    content={heroContent}
    showFinale={false}
    motion={{ viewportsPerChapter: 3, maxChapterScroll: 3600, scrub: 1.15 }}
  />
  <DotField
    headline={"Start with your data.\nBuild from there."}
    eyebrow="FROM EXPLORATION TO IMPLEMENTATION"
    description="Connect your catalog. Start a conversation. Keep control of every order."
    fontFamily="Inter Variable, sans-serif"
    fontWeight={600}
    accent="#9daeff"
    grid={[22, 16]}
    actions={<AntiMetalLink to="/docs/quickstart">Read the quickstart</AntiMetalLink>}
    scrollHint={{ scatter: 'Scroll to explore', gather: 'Scroll up to gather' }}
  />
  <TechnologyMarquee />
  <section id="home-overview" tabIndex={-1} className="docs-section"><div className="section-heading"><p className="kicker">COMMERCE, IN CONVERSATION</p><h2>Your products.<br/>A more helpful way to shop.</h2><p>Veyrix brings catalog discovery, shopping conversations, and explicit order confirmation into one local agent.</p></div><FeaturesSectionWithHoverEffects /></section>
  <section className="home-footer-invitation" aria-labelledby="footer-invitation-title">
    <div className="footer-invitation-copy"><p className="kicker">YOUR NEXT STEP</p><h2 id="footer-invitation-title">Meet the engine.<br/><span>Build the conversation.</span></h2><p>Explore how Veyrix works, connect your catalog, and run your first shopping conversation locally.</p></div>
    <div className="footer-invitation-actions"><span className="footer-project-note"><i aria-hidden="true"/> BUILT AS A LOCAL PROTOTYPE</span><AntiMetalLink to="/docs/quickstart">Start with the quickstart</AntiMetalLink><AntiMetalLink to="/docs">Explore the documentation</AntiMetalLink></div>
  </section>
</>; }
