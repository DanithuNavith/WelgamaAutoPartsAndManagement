import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, ShieldCheck, Clock, Star, ChevronRight, Phone, MapPin, Mail, Zap, Car, Settings } from 'lucide-react';

const Home = () => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="home-page" style={{ background: '#0a0e1a', minHeight: '100vh', overflow: 'hidden' }}>
      {/* Animated background orbs */}
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0
      }}>
        <div style={{
          position: 'absolute', top: '-20%', left: '-10%', width: '600px', height: '600px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
          animation: 'float1 15s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', right: '-10%', width: '500px', height: '500px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)',
          animation: 'float2 18s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute', top: '40%', right: '20%', width: '300px', height: '300px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
          animation: 'float3 12s ease-in-out infinite'
        }} />
      </div>

      {/* Navigation */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '1rem 2rem',
        background: scrollY > 50 ? 'rgba(10, 14, 26, 0.9)' : 'transparent',
        backdropFilter: scrollY > 50 ? 'blur(20px)' : 'none',
        borderBottom: scrollY > 50 ? '1px solid rgba(255,255,255,0.06)' : 'none',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(59,130,246,0.3)'
          }}>
            <Settings size={22} color="#fff" />
          </div>
          <div>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>Welgama</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 300, color: '#94a3b8', marginLeft: '0.35rem' }}>Auto</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/login" style={{
            padding: '0.6rem 1.5rem', borderRadius: '10px', textDecoration: 'none',
            color: '#cbd5e1', fontSize: '0.9rem', fontWeight: 500,
            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
            transition: 'all 0.3s', cursor: 'pointer'
          }}
          onMouseOver={e => { e.target.style.background = 'rgba(255,255,255,0.08)'; e.target.style.borderColor = 'rgba(255,255,255,0.2)'; }}
          onMouseOut={e => { e.target.style.background = 'rgba(255,255,255,0.03)'; e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          >
            Sign In
          </Link>
          <Link to="/login?tab=register" style={{
            padding: '0.6rem 1.5rem', borderRadius: '10px', textDecoration: 'none',
            color: '#fff', fontSize: '0.9rem', fontWeight: 500,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            boxShadow: '0 4px 15px rgba(59,130,246,0.3)',
            transition: 'all 0.3s', cursor: 'pointer'
          }}
          onMouseOver={e => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 20px rgba(59,130,246,0.4)'; }}
          onMouseOut={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 15px rgba(59,130,246,0.3)'; }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '6rem 2rem 4rem'
      }}>
        <div style={{ maxWidth: '800px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: '999px', padding: '0.4rem 1rem', marginBottom: '2rem',
            fontSize: '0.8rem', color: '#60a5fa', fontWeight: 500,
            animation: 'fadeInUp 0.8s ease-out'
          }}>
            <Zap size={14} /> Trusted Auto Parts & Service Since 1998
          </div>

          <h1 style={{
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 800,
            lineHeight: 1.1, marginBottom: '1.5rem', letterSpacing: '-0.04em',
            animation: 'fadeInUp 0.8s ease-out 0.1s both'
          }}>
            <span style={{ color: '#f8fafc' }}>Your Vehicle </span>
            <span style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>Deserves </span>
            <br />
            <span style={{ color: '#f8fafc' }}>The Best Care</span>
          </h1>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: '#94a3b8', lineHeight: 1.7,
            maxWidth: '600px', margin: '0 auto 2.5rem',
            animation: 'fadeInUp 0.8s ease-out 0.2s both'
          }}>
            Welgama Auto Parts & Management provides premium quality auto parts,
            expert repair services, and comprehensive vehicle management — all under one roof.
          </p>

          <div style={{
            display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap',
            animation: 'fadeInUp 0.8s ease-out 0.3s both'
          }}>
            <Link to="/login" style={{
              padding: '0.9rem 2.5rem', borderRadius: '14px', textDecoration: 'none',
              color: '#fff', fontSize: '1rem', fontWeight: 600,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              boxShadow: '0 8px 30px rgba(59,130,246,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              transition: 'all 0.3s'
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(59,130,246,0.45)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(59,130,246,0.35)'; }}
            >
              Login to Dashboard <ChevronRight size={18} />
            </Link>
            <a href="#services" style={{
              padding: '0.9rem 2.5rem', borderRadius: '14px', textDecoration: 'none',
              color: '#cbd5e1', fontSize: '1rem', fontWeight: 500,
              border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)',
              transition: 'all 0.3s'
            }}
            onMouseOver={e => { e.target.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseOut={e => { e.target.style.background = 'rgba(255,255,255,0.04)'; }}
            >
              Explore Services
            </a>
          </div>

          {/* Stats row */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: '3rem', marginTop: '4rem',
            animation: 'fadeInUp 0.8s ease-out 0.5s both', flexWrap: 'wrap'
          }}>
            {[
              { value: '25+', label: 'Years Experience' },
              { value: '1000', label: 'Parts in Stock' },
              { value: '5K+', label: 'Happy Customers' },
              { value: '24/7', label: 'Support Available' }
            ].map((stat, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc' }}>{stat.value}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" style={{
        position: 'relative', zIndex: 1, padding: '6rem 2rem'
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <span style={{
              fontSize: '0.8rem', fontWeight: 600, color: '#3b82f6',
              textTransform: 'uppercase', letterSpacing: '0.15em'
            }}>What We Offer</span>
            <h2 style={{
              fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 700, color: '#f8fafc',
              marginTop: '0.75rem', letterSpacing: '-0.03em'
            }}>
              Complete Auto Solutions
            </h2>
            <p style={{ color: '#64748b', marginTop: '1rem', maxWidth: '550px', margin: '1rem auto 0', lineHeight: 1.7 }}>
              From genuine spare parts to expert repairs — we deliver quality service at every step.
            </p>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem'
          }}>
            {[
              {
                icon: Car, title: 'Auto Parts Supply',
                desc: 'Genuine OEM and aftermarket parts for all major vehicle brands. We stock everything from engine components to body parts.',
                gradient: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))',
                iconBg: 'rgba(59,130,246,0.2)', iconColor: '#60a5fa',
                borderColor: 'rgba(59,130,246,0.15)'
              },
              {
                icon: Wrench, title: 'Expert Repairs',
                desc: 'Certified technicians with decades of experience handling everything from routine maintenance to complex engine overhauls.',
                gradient: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))',
                iconBg: 'rgba(16,185,129,0.2)', iconColor: '#34d399',
                borderColor: 'rgba(16,185,129,0.15)'
              },
              {
                icon: ShieldCheck, title: 'Quality Guarantee',
                desc: 'Every part we sell and every repair we perform comes with our satisfaction guarantee. Your trust is our top priority.',
                gradient: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05))',
                iconBg: 'rgba(139,92,246,0.2)', iconColor: '#a78bfa',
                borderColor: 'rgba(139,92,246,0.15)'
              }
            ].map((service, i) => (
              <div key={i} style={{
                background: service.gradient, border: `1px solid ${service.borderColor}`,
                borderRadius: '1.25rem', padding: '2rem',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'default',
                position: 'relative', overflow: 'hidden'
              }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{
                  width: '52px', height: '52px', borderRadius: '14px',
                  background: service.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '1.25rem'
                }}>
                  <service.icon size={24} color={service.iconColor} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.75rem' }}>
                  {service.title}
                </h3>
                <p style={{ color: '#94a3b8', lineHeight: 1.7, fontSize: '0.9rem' }}>
                  {service.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section style={{
        position: 'relative', zIndex: 1, padding: '6rem 2rem',
        background: 'linear-gradient(180deg, transparent 0%, rgba(59,130,246,0.03) 50%, transparent 100%)'
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <span style={{
              fontSize: '0.8rem', fontWeight: 600, color: '#10b981',
              textTransform: 'uppercase', letterSpacing: '0.15em'
            }}>Why Choose Us</span>
            <h2 style={{
              fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 700, color: '#f8fafc',
              marginTop: '0.75rem', letterSpacing: '-0.03em'
            }}>
              Built on Trust & Excellence
            </h2>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2rem'
          }}>
            {[
              { icon: ShieldCheck, title: 'Genuine Parts', desc: 'Only authentic, quality-tested parts from verified suppliers', color: '#3b82f6' },
              { icon: Clock, title: 'Fast Turnaround', desc: 'Quick service with minimal wait times for repairs and parts', color: '#10b981' },
              { icon: Star, title: 'Expert Technicians', desc: 'Skilled professionals with years of hands-on experience', color: '#f59e0b' },
              { icon: Phone, title: 'Always Available', desc: '24/7 customer support and emergency roadside assistance', color: '#8b5cf6' }
            ].map((item, i) => (
              <div key={i} style={{
                textAlign: 'center', padding: '2rem 1.5rem',
                borderRadius: '1rem', background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                transition: 'all 0.3s'
              }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
              >
                <div style={{
                  width: '56px', height: '56px', borderRadius: '16px',
                  background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}>
                  <item.icon size={26} color={item.color} />
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>
                  {item.title}
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.6 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        position: 'relative', zIndex: 1, padding: '6rem 2rem'
      }}>
        <div style={{
          maxWidth: '800px', margin: '0 auto', textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.08))',
          border: '1px solid rgba(59,130,246,0.15)', borderRadius: '1.5rem',
          padding: '4rem 2rem', position: 'relative', overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', top: '-50%', left: '-20%', width: '400px', height: '400px',
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)'
          }} />
          <h2 style={{
            fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 700, color: '#f8fafc',
            marginBottom: '1rem', position: 'relative'
          }}>
            Ready to Experience Premium Auto Service?
          </h2>
          <p style={{ color: '#94a3b8', marginBottom: '2rem', position: 'relative', lineHeight: 1.7 }}>
            Create an account to track your vehicle repairs, browse our parts catalog,
            and get exclusive member discounts.
          </p>
          <Link to="/login?tab=register" style={{
            padding: '0.9rem 2.5rem', borderRadius: '14px', textDecoration: 'none',
            color: '#fff', fontSize: '1rem', fontWeight: 600,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            boxShadow: '0 8px 30px rgba(59,130,246,0.35)',
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            transition: 'all 0.3s', position: 'relative'
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Create Free Account <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        position: 'relative', zIndex: 1, padding: '3rem 2rem',
        borderTop: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Settings size={20} color="#3b82f6" />
              <span style={{ fontWeight: 700, color: '#f8fafc' }}>Welgama Auto</span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.7 }}>
              Your trusted partner for quality auto parts and expert vehicle repairs since 1998.
            </p>
          </div>
          <div>
            <h4 style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Quick Links</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <a href="#services" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem', transition: 'color 0.2s' }}
                onMouseOver={e => e.target.style.color = '#f8fafc'} onMouseOut={e => e.target.style.color = '#64748b'}>Services</a>
              <Link to="/login" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem', transition: 'color 0.2s' }}
                onMouseOver={e => e.target.style.color = '#f8fafc'} onMouseOut={e => e.target.style.color = '#64748b'}>Login</Link>
              <Link to="/login?tab=register" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem', transition: 'color 0.2s' }}
                onMouseOver={e => e.target.style.color = '#f8fafc'} onMouseOut={e => e.target.style.color = '#64748b'}>Register</Link>
            </div>
          </div>
          <div>
            <h4 style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Contact</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                <MapPin size={14} /> Welgama Auto Parts & Repairs, Kahanthota Road, Malabe, Western Province, Sri Lanka
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                <Phone size={14} /> +94 77 804 7020
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                <Mail size={14} /> info@welgamaauto.lk
              </div>
            </div>
          </div>
        </div>
        <div style={{
          maxWidth: '1100px', margin: '2rem auto 0', paddingTop: '1.5rem',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          textAlign: 'center', color: '#475569', fontSize: '0.8rem'
        }}>
          © 2026 Welgama Auto Parts & Management. All rights reserved.
        </div>
      </footer>

      {/* Keyframe animations */}
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(60px, 40px); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-50px, -30px); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-30px, 50px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Home;
