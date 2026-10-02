import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Car,
  ChevronRight,
  Clock,
  Mail,
  MapPin,
  Menu,
  Phone,
  Settings,
  ShieldCheck,
  Star,
  Wrench,
  X,
  Zap
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import './Home.css';

const services = [
  {
    icon: Car,
    title: 'Auto Parts Supply',
    desc: 'Genuine OEM and aftermarket parts for all major vehicle brands, from engine components to body parts.',
    tone: 'blue'
  },
  {
    icon: Wrench,
    title: 'Expert Repairs',
    desc: 'Experienced technicians for routine maintenance, diagnostics, and complex repairs.',
    tone: 'green'
  },
  {
    icon: ShieldCheck,
    title: 'Quality Guarantee',
    desc: 'Quality-tested parts and repairs, with your satisfaction and trust at the heart of our service.',
    tone: 'purple'
  }
];

const reasons = [
  { icon: ShieldCheck, title: 'Genuine Parts', desc: 'Quality-tested parts from verified suppliers', color: 'blue' },
  { icon: Clock, title: 'Fast Turnaround', desc: 'Efficient service for repairs and parts', color: 'green' },
  { icon: Star, title: 'Expert Technicians', desc: 'Skilled professionals with hands-on experience', color: 'amber' },
  { icon: Phone, title: 'Here to Help', desc: 'Get in touch with our team when you need support', color: 'purple' }
];

const stats = [
  { value: '25+', label: 'Years Experience' },
  { value: '1000', label: 'Parts in Stock' },
  { value: '5K+', label: 'Happy Customers' },
  { value: '24/7', label: 'Support Available' }
];

const Home = () => {
  const [scrollY, setScrollY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="home-page">
      <div className="home-background" aria-hidden="true">
        <span className="home-orb home-orb-blue" />
        <span className="home-orb home-orb-green" />
        <span className="home-orb home-orb-purple" />
      </div>

      <header className={`home-header${scrollY > 50 ? ' is-scrolled' : ''}`}>
        <Link to="/" className="home-brand" aria-label="Welgama Auto Parts home" onClick={closeMenu}>
          <BrandLogo width={150} />
        </Link>
        <button
          className="home-menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="home-navigation"
          onClick={() => setMenuOpen(open => !open)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav id="home-navigation" className={`home-navigation${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
          <div className="home-nav-links">
            <a href="#services" onClick={closeMenu}>Services</a>
            <a href="#why-us" onClick={closeMenu}>Why Welgama</a>
            <a href="#contact" onClick={closeMenu}>Contact</a>
          </div>
          <div className="home-nav-actions">
            <Link className="home-button home-button-quiet" to="/login" onClick={closeMenu}>Sign In</Link>
            <Link className="home-button home-button-primary home-nav-cta" to="/login?tab=register" onClick={closeMenu}>Get Started</Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="home-hero">
          <div className="home-hero-copy">
            <div className="home-eyebrow"><Zap size={14} aria-hidden="true" /> Trusted Auto Parts &amp; Service Since 1998</div>
            <h1>
              Your Vehicle<br />
              <span>Deserves the Best Care</span>
            </h1>
            <p className="home-hero-description">
              Welgama Auto Parts &amp; Management provides quality auto parts,
              expert repair services, and vehicle management — all under one roof.
            </p>
            <div className="home-hero-actions">
              <Link className="home-button home-button-primary home-button-large" to="/login?tab=register">
                Get Started <ChevronRight size={18} aria-hidden="true" />
              </Link>
              <a className="home-button home-button-outline home-button-large" href="#services">Explore Services</a>
            </div>
            <div className="home-stats" aria-label="Welgama Auto Parts at a glance">
              {stats.map(stat => (
                <div className="home-stat" key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="home-hero-visual" aria-hidden="true">
            <div className="home-visual-grid" />
            <div className="home-visual-ring home-visual-ring-outer" />
            <div className="home-visual-ring home-visual-ring-inner" />
            <div className="home-car-illustration">
              <div className="home-car-glow" />
              <Car className="home-car-icon" strokeWidth={1.15} />
              <div className="home-car-base" />
            </div>
            <div className="home-visual-label home-label-parts">
              <span className="home-label-icon"><Settings size={17} /></span>
              <span><strong>Quality Parts</strong><small>For your vehicle</small></span>
            </div>
            <div className="home-visual-label home-label-service">
              <span className="home-label-icon"><Wrench size={17} /></span>
              <span><strong>Expert Service</strong><small>Care you can trust</small></span>
            </div>
          </div>
        </section>

        <section className="home-section" id="services">
          <div className="home-section-heading">
            <span className="home-section-kicker">What We Offer</span>
            <h2>Complete Auto Solutions</h2>
            <p>From quality spare parts to expert repairs — support for every step of your journey.</p>
          </div>
          <div className="home-service-grid">
            {services.map(service => (
              <article className={`home-service-card tone-${service.tone}`} key={service.title}>
                <div className="home-card-icon"><service.icon size={24} aria-hidden="true" /></div>
                <h3>{service.title}</h3>
                <p>{service.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section home-why-section" id="why-us">
          <div className="home-section-heading">
            <span className="home-section-kicker is-green">Why Choose Us</span>
            <h2>Built on Trust &amp; Excellence</h2>
          </div>
          <div className="home-reasons-grid">
            {reasons.map(reason => (
              <article className="home-reason-card" key={reason.title}>
                <div className={`home-reason-icon tone-${reason.color}`}>
                  <reason.icon size={25} aria-hidden="true" />
                </div>
                <h3>{reason.title}</h3>
                <p>{reason.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-cta-section">
          <div className="home-cta-card">
            <h2>Ready for dependable auto service?</h2>
            <p>Create an account to track your vehicle repairs and manage your service appointments.</p>
            <Link className="home-button home-button-primary home-button-large" to="/login?tab=register">
              Create Free Account <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="home-footer" id="contact">
        <div className="home-footer-grid">
          <div className="home-footer-about">
            <BrandLogo width={120} />
            <p>Your trusted partner for quality auto parts and expert vehicle repairs since 1998.</p>
          </div>
          <div>
            <h2 className="home-footer-heading">Quick Links</h2>
            <div className="home-footer-links">
              <a href="#services">Services</a>
              <a href="#why-us">Why Welgama</a>
              <Link to="/login">Sign In</Link>
              <Link to="/login?tab=register">Register</Link>
            </div>
          </div>
          <div>
            <h2 className="home-footer-heading">Contact</h2>
            <div className="home-contact-list">
              <a href="https://maps.google.com/?q=Welgama+Auto+Parts+Kahanthota+Road+Malabe+Sri+Lanka">
                <MapPin size={15} aria-hidden="true" />
                <span>Welgama Auto Parts &amp; Repairs, Kahanthota Road, Malabe, Western Province, Sri Lanka</span>
              </a>
              <a href="tel:+94778047020"><Phone size={15} aria-hidden="true" /><span>+94 77 804 7020</span></a>
              <a href="mailto:info@welgamaauto.lk"><Mail size={15} aria-hidden="true" /><span>info@welgamaauto.lk</span></a>
            </div>
          </div>
        </div>
        <div className="home-footer-bottom">© 2026 Welgama Auto Parts &amp; Management. All rights reserved.</div>
      </footer>
    </div>
  );
};

export default Home;
