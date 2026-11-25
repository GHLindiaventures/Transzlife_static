import { Link } from 'react-router-dom';
import { Leaf, ShieldCheck, Recycle, HeartHandshake, CheckCircle2, ArrowRight, Sprout, Wind, Droplets } from 'lucide-react';
import '../styles/content.css';

export default function Sustainability() {
  return (
    <div className="sustain-page">
      {/* Hero Banner */}
      <section className="sustain-hero">
        <div className="sustain-hero__bg" aria-hidden="true" />
        <div className="sustain-hero__inner">
          <div className="sustain-pill">
            <Leaf size={14} className="sustain-pill__ic" />
            <span>Environmental Stewardship &amp; Ethical Ayurveda</span>
          </div>
          <h1 className="sustain-hero__title">
            Rooted in Nature.<br />
            <em>Committed to the Earth.</em>
          </h1>
          <p className="sustain-hero__lead">
            At TranzLife Biosciences, wellness is never achieved at the expense of our planet. From sustainable wildcrafting in the Western Ghats to zero-effluent supercritical extraction and recyclable glass packaging, our circular commitments ensure nature continues to thrive for generations to come.
          </p>
        </div>
      </section>

      {/* Impact Stats */}
      <section className="sustain-metrics">
        <div className="sustain-metrics__grid">
          <div className="sustain-metric">
            <span className="sustain-metric__num">100%</span>
            <span className="sustain-metric__label">Solvent-Free Extraction</span>
            <span className="sustain-metric__sub">Zero petrochemical hexane, acetone or chemical solvents used</span>
          </div>
          <div className="sustain-metric">
            <span className="sustain-metric__num">0.00%</span>
            <span className="sustain-metric__label">Toxic Chemical Effluents</span>
            <span className="sustain-metric__sub">Closed-loop CO₂ systems create zero toxic wastewater discharge</span>
          </div>
          <div className="sustain-metric">
            <span className="sustain-metric__num">92%+</span>
            <span className="sustain-metric__label">Plastic-Eliminated Packaging</span>
            <span className="sustain-metric__sub">Pharmaceutical amber glass and FSC-certified recyclable kraft paper</span>
          </div>
          <div className="sustain-metric">
            <span className="sustain-metric__num">100%</span>
            <span className="sustain-metric__label">Traceable Farm Sourcing</span>
            <span className="sustain-metric__sub">Fair-trade partnerships with regenerative botanical cultivators in India</span>
          </div>
        </div>
      </section>

      {/* 4 Pillars of Sustainable Biosciences */}
      <section className="sustain-pillars">
        <div className="sustain-section-header">
          <span className="sustain-kicker">Our Four Commitments</span>
          <h2 className="sustain-section-title">The TranzLife Sustainable Lifecycle</h2>
          <p className="sustain-section-desc">
            How we combine pharmaceutical precision with ecological restoration across every touchpoint from seed to shelf.
          </p>
        </div>

        <div className="sustain-cards">
          {/* Card 1 */}
          <article className="sustain-card">
            <div className="sustain-card__icon"><Sprout size={28} /></div>
            <span className="sustain-card__step">01 / Forest Conservation</span>
            <h3>Ethical Wildcrafting in the Western Ghats</h3>
            <p>
              We harvest rare botanical varietals through non-destructive, regenerative wildcrafting protocols. Harvesters leave roots and crown seeds untouched, allowing wild populations of <em>Vasaka</em>, <em>Kalmegh</em>, and <em>Bhumyamalaki</em> to naturally re-propagate season after season.
            </p>
            <ul className="sustain-card__list">
              <li><CheckCircle2 size={16} /> GPS harvest tracking prevents localized over-harvesting</li>
              <li><CheckCircle2 size={16} /> Certified chemical pesticide and herbicide-free habitats</li>
              <li><CheckCircle2 size={16} /> Botanical species protected under sustainable AYUSH harvesting guidelines</li>
            </ul>
          </article>

          {/* Card 2 */}
          <article className="sustain-card">
            <div className="sustain-card__icon"><Wind size={28} /></div>
            <span className="sustain-card__step">02 / Green Chemistry</span>
            <h3>Zero-Solvent Supercritical CO₂ Extraction</h3>
            <p>
              Traditional chemical extraction relies on petroleum solvents like hexane or ethanol that generate toxic chemical runoff. TranzLife utilizes supercritical carbon dioxide that penetrates raw botanicals under controlled pressure and simply evaporates clean, captured in a closed-loop recycling circuit.
            </p>
            <ul className="sustain-card__list">
              <li><CheckCircle2 size={16} /> 99.8% of process CO₂ is reclaimed and recycled</li>
              <li><CheckCircle2 size={16} /> 0% chemical residues or volatile organic compounds (VOCs)</li>
              <li><CheckCircle2 size={16} /> Clean biomass compost returned to agricultural soil</li>
            </ul>
          </article>

          {/* Card 3 */}
          <article className="sustain-card">
            <div className="sustain-card__icon"><Recycle size={28} /></div>
            <span className="sustain-card__step">03 / Responsible Materials</span>
            <h3>Pharmaceutical Amber &amp; Miron Glass</h3>
            <p>
              To protect active phytochemical molecules from sunlight degradation without relying on multi-layer plastic bottles, our liquids, concoctions, and roll-ons are bottled in infinitely recyclable amber glass. Outer packaging utilizes 100% biodegradable, unbleached kraft paper with vegetable soy ink.
            </p>
            <ul className="sustain-card__list">
              <li><CheckCircle2 size={16} /> 100% recyclable glass prevents microplastic leeching</li>
              <li><CheckCircle2 size={16} /> FSC-certified unbleached cartons decompose naturally</li>
              <li><CheckCircle2 size={16} /> Reduced secondary shipping fillers and zero plastic bubble wrap</li>
            </ul>
          </article>

          {/* Card 4 */}
          <article className="sustain-card">
            <div className="sustain-card__icon"><HeartHandshake size={28} /></div>
            <span className="sustain-card__step">04 / Social Stewardship</span>
            <h3>Fair-Trade Regenerative Farmer Partnerships</h3>
            <p>
              We bypass predatory middlemen to contract directly with smallholder farmers across Tamil Nadu, Kerala, and the Himalayan foothills. We provide regenerative agriculture training, organic soil testing, and guaranteed fair living-wage crop buybacks.
            </p>
            <ul className="sustain-card__list">
              <li><CheckCircle2 size={16} /> Above-market price guarantees provide family stability</li>
              <li><CheckCircle2 size={16} /> Organic composting and rainwater harvesting incentives</li>
              <li><CheckCircle2 size={16} /> Direct knowledge-sharing between our phytochemists and indigenous growers</li>
            </ul>
          </article>
        </div>
      </section>

      {/* CTA Box */}
      <section className="sustain-cta">
        <div className="sustain-cta__inner">
          <h2>Experience Natural Science in Harmony with the Planet</h2>
          <p>Explore our laboratory-tested, sustainably crafted Ayurvedic formulations.</p>
          <div className="sustain-cta__btns">
            <Link to="/shop" className="btn btn--light">Shop Sustainable Formulations</Link>
            <Link to="/blogs" className="btn btn--outline">Read Our Blogs</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
